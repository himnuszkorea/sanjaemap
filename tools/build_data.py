"""산재보험 지정의료기관 현황(공공데이터포털 CSV) → data/hospitals.json (브이월드 지오코더로 좌표 부여)

사용: py -3 tools/build_data.py raw/<현황.csv> [--no-geocode]
- --no-geocode: 캐시에 있는 좌표만 쓰고 브이월드를 부르지 않는다(키 없이 화면 시험용).
- 원본: 공공데이터포털 「근로복지공단_산재보험 지정의료기관 현황정보」(data.go.kr/data/3044320), CP949 CSV.
  칸은 의료기관기호·의료기관명·우편번호·주소·전화번호 뿐이다 — 종류는 이름으로 추정한다.
- 좌표는 tools/geocode_cache.json 에 주소별로 저장해 재실행 때 다시 부르지 않는다(중단해도 이어받는다).
- 키는 저장소 루트 .env.local 의 VWORLD_KEY. 화면에 출력하지 않는다.
- 지오코딩 규칙(clean·candidates·geocode·OVERRIDE·INCHEON)은
  claude-code/gj-hearing-clinic-map/build_data.py(청력 특진 지도)에서 옮겨 왔다. 고칠 일이 있으면 두 곳을 같이 본다.
"""
import csv, json, re, ssl, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "geocode_cache.json"
OUT = ROOT / "data" / "hospitals.json"
# 청력 특진 의뢰기관 표시용(있으면 쓴다). 같은 작업 루트의 특진 지도 데이터.
HEARING = ROOT.parent / "claude-code" / "gj-hearing-clinic-map" / "data" / "clinics.json"
HEARING_CACHE = HEARING.parent.parent / "geocode_cache.json"

ctx = ssl.create_default_context()
ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
ctx.set_ciphers("DEFAULT:@SECLEVEL=0")  # 공단 망 TLS 인터셉트 CA 키가 짧다

SIDO = {"서울시": "서울특별시", "전남광주": "광주광역시"}  # 원본 표기 → 지오코더가 아는 표기
OVERRIDE = {
    "서울 동작구 신대방2동 시립보라매병원": "서울특별시 동작구 보라매로5길 20",
    "울산 동구 방어진순환도로 877 (전하동)": "울산광역시 동구 대학병원로 25",
    "경기도 고양시 일산구대화동 2240번지": "경기도 고양시 일산서구 주화로 170",
}
# 인천 행정구역 개편(2026.7.1.) — 옛 구 이름이면 새 구 이름으로도 찾아본다
INCHEON = {"중구": ["제물포구", "영종구"], "동구": ["제물포구"], "서구": ["서해구", "검단구"]}

# 화면 필터용 시도 약칭
SIDO_SHORT = {
    "서울": "서울", "서울특별시": "서울", "부산": "부산", "부산광역시": "부산", "대구": "대구", "대구광역시": "대구",
    "인천": "인천", "인천광역시": "인천", "광주": "광주", "광주광역시": "광주", "대전": "대전", "대전광역시": "대전",
    "울산": "울산", "울산광역시": "울산", "세종": "세종", "세종시": "세종", "세종특별자치시": "세종",
    "경기": "경기", "경기도": "경기", "강원": "강원", "강원도": "강원", "강원특별자치도": "강원",
    "충북": "충북", "충청북도": "충북", "충남": "충남", "충청남도": "충남",
    "전북": "전북", "전라북도": "전북", "전북특별자치도": "전북", "전남": "전남", "전라남도": "전남",
    "경북": "경북", "경상북도": "경북", "경남": "경남", "경상남도": "경남",
    "제주": "제주", "제주도": "제주", "제주특별자치도": "제주",
}
KINDS = ["대학병원·의료원", "병원", "요양병원", "의원", "치과", "한방", "기타"]


def load_key():
    return re.search(r"^VWORLD_KEY=(\S+)", (ROOT / ".env.local").read_text(encoding="utf-8-sig"), re.M).group(1)


def clean(addr):
    a = re.sub(r"\s+", " ", str(addr)).strip()
    head, _, rest = a.partition(" ")
    a = f"{SIDO.get(head, head)} {rest}".strip()
    a = re.sub(r"((?:로|길)\d+번길)(\d)", r"\1 \2", a)  # '심곡로100번길25' → '심곡로100번길 25'
    return a


def candidates(addr):
    a = clean(OVERRIDE.get(addr, addr))
    m = re.match(r"(인천(?:광역시)?) (중구|동구|서구) (.*)", a)
    if m:
        for gu in INCHEON[m.group(2)]:
            yield from candidates_one(f"인천광역시 {gu} {m.group(3)}")
    yield from candidates_one(a)


def candidates_one(a):
    yield a
    no_paren = re.sub(r"\s*\(.*?\)\s*", " ", a).strip()
    if no_paren != a:
        yield no_paren
    m = re.match(r"(.+?(?:로|길)\s?\d+(?:-\d+)?)", no_paren)  # 도로명+건물번호까지만
    if m and m.group(1) != no_paren:
        yield m.group(1)
    yield re.sub(r"번지.*$", "", no_paren).strip()  # 지번: '번지' 제거


def geocode(addr, key):
    for cand in dict.fromkeys(candidates(addr)):
        for typ in ("road", "parcel"):
            q = {"service": "address", "request": "getcoord", "version": "2.0", "crs": "epsg:4326",
                 "address": cand, "refine": "true", "simple": "false", "format": "json",
                 "type": typ, "key": key}
            url = "https://api.vworld.kr/req/address?" + urllib.parse.urlencode(q)
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(url, timeout=20, context=ctx) as r:
                        resp = json.loads(r.read().decode("utf-8"))["response"]
                    break
                except (OSError, ValueError):
                    if attempt == 2:
                        raise
                    time.sleep(2 * (attempt + 1))
            if resp.get("status") == "OK":
                p = resp["result"]["point"]
                return {"lng": float(p["x"]), "lat": float(p["y"]), "q": cand, "type": typ,
                        "refined": resp.get("refined", {}).get("text")}
            if resp.get("status") == "ERROR":
                raise RuntimeError(resp.get("error"))
    return None


def kind_of(name):
    """의료기관 종류 — 원본에 칸이 없어 이름으로 추정한다(화면에 '이름 기준 추정'으로 표기).
    괄호('(의료법인)'·'(김포)')는 먼저 빼고 보고, 그래도 모르면 괄호 안('…의료재단(인창병원)')까지 본다."""
    k = _kind(re.sub(r"[(（].*?[)）]", "", name))
    return _kind(name) if k == "기타" else k


def _kind(n):
    if "치과" in n:
        return "치과"
    if re.search(r"한의원|한방", n):
        return "한방"
    if "요양병원" in n:
        return "요양병원"
    if re.search(r"대학교|대학병원|의료원|세브란스", n):
        return "대학병원·의료원"
    if "병원" in n:
        return "병원"
    if re.search(r"의원|과$|센터|클리닉|메디칼|메디컬", n):
        return "의원"
    return "기타"


def region(addr):
    """주소 → (시도 약칭, 시군구). '경기 수원시 장안구' → ('경기', '수원시 장안구')."""
    t = re.sub(r"\s*\(.*?\)", "", addr).split()
    if not t:
        return "", ""
    sido = SIDO_SHORT.get(t[0], "")
    if not sido:
        return "", ""
    if sido == "세종":
        return sido, "세종시"
    rest = t[1:]
    if not rest:
        return sido, ""
    sgg = rest[0]
    if sgg.endswith("시") and len(rest) > 1 and re.fullmatch(r"\S+구", rest[1]):
        sgg += " " + rest[1]
    return sido, sgg


def in_korea(pt):
    return pt and 33.0 <= pt["lat"] <= 38.7 and 124.5 <= pt["lng"] <= 131.0


def main(src, no_geocode=False):
    with open(src, encoding="cp949", newline="") as f:
        rows = list(csv.DictReader(f))
    need = ["의료기관기호", "의료기관명", "우편번호", "주소", "전화번호"]
    if not rows or list(rows[0].keys())[:5] != need:
        sys.exit(f"칸 이름이 예상과 다르다: {list(rows[0].keys()) if rows else '빈 파일'}")

    if CACHE.exists():
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    elif HEARING_CACHE.exists():  # 처음엔 특진 지도의 좌표 캐시로 시작(같은 주소 재호출 없음)
        cache = json.loads(HEARING_CACHE.read_text(encoding="utf-8"))
    else:
        cache = {}
    cache = {k: v for k, v in cache.items() if v}  # 실패분은 다시 찾는다

    todo = list(dict.fromkeys(r["주소"].strip() for r in rows if r["주소"].strip() not in cache))
    if no_geocode:
        todo = []
    key = load_key() if todo else None
    print(f"{len(rows)}행, 좌표 캐시 있음 {len(rows) - sum(1 for r in rows if r['주소'].strip() not in cache)}행, 새로 찾을 주소 {len(todo)}개", flush=True)
    lock, done = threading.Lock(), [0]

    def work(addr):
        pt = geocode(addr, key)
        with lock:
            cache[addr] = pt
            done[0] += 1
            if done[0] % 50 == 0:
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"  {done[0]}/{len(todo)}", flush=True)

    try:
        with ThreadPoolExecutor(4) as ex:
            list(ex.map(work, todo))
    finally:
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")

    hearing = set()
    if HEARING.exists():
        hearing = {c["code"] for c in json.loads(HEARING.read_text(encoding="utf-8"))["clinics"] if c.get("code") and not c.get("note")}

    out, failed = [], []
    for r in rows:
        addr = re.sub(r"\s+", " ", r["주소"]).strip()
        pt = cache.get(r["주소"].strip())
        ok = in_korea(pt)
        sido, sgg = region((pt or {}).get("refined") or addr)
        if not sido:
            sido, sgg = region(addr)
        zipc = r["우편번호"].strip()
        out.append([
            r["의료기관기호"].strip(), r["의료기관명"].strip(), zipc.zfill(5) if zipc.isdigit() else zipc,
            addr, r["전화번호"].strip(), KINDS.index(kind_of(r["의료기관명"])), sido, sgg,
            round(pt["lat"], 6) if ok else None, round(pt["lng"], 6) if ok else None,
            1 if r["의료기관기호"].strip() in hearing else 0,
        ])
        if not ok:
            failed.append(f'{r["의료기관명"]} | {addr}')

    m = re.search(r"(\d{8})", Path(src).stem)
    asof = f"{m[1][:4]}-{m[1][4:6]}-{m[1][6:]}" if m else ""
    meta = {"title": "근로복지공단 산재보험 지정의료기관 현황정보", "asof": asof,
            "source": "공공데이터포털 data.go.kr/data/3044320 (근로복지공단)",
            "built": date.today().isoformat(), "count": len(out), "geocoded": len(out) - len(failed),
            "fields": ["code", "name", "zip", "addr", "tel", "kind", "sido", "sgg", "lat", "lng", "hearing"],
            "kinds": KINDS}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"meta": meta, "rows": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.name} {OUT.stat().st_size // 1024}KB · {len(out)}곳 · 좌표 {len(out) - len(failed)} · 실패 {len(failed)} · 청력 특진 {sum(r[10] for r in out)}")
    from collections import Counter
    print("종류:", dict(Counter(KINDS[r[5]] for r in out)))
    print("시도:", dict(Counter(r[6] or "?" for r in out)))
    for f in failed:
        print("  실패:", f)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1], "--no-geocode" in sys.argv[2:])
