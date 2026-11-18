"""산재지정 약국 · 재활인증의료기관(공공데이터포털 오픈API) → data/rehab.json · data/pharm.json

사용: py -3 tools/build_extra.py [--no-geocode]
- 원본: 공공데이터포털 「근로복지공단_산재병원 의료 현황정보」(data.go.kr/data/15058644, 이용허락 제한 없음)
  · 산재지정 약국 찾기 조회        getSjJijeongyakgukChakgiList   (hospitalNm·addr·tel·faxTel·gwanriJisaCd·jisaNm)
  · 산재지정 재활인증의료기관 현황  getSjBoheomJhCftHptPstateList  (hospitalNo·hospitalNm·gtCdNm1·addr·tel·…)
- 화면은 API 를 부르지 않는다 — 빌드 때 받아 정적 JSON 으로 둔다(키가 화면에 나가지 않게, 2026-11-18 사용자 제안 4).
- 인증키: 환경변수 DATA_GO_KR_KEY, 없으면 저장소 루트 .env.local 의 DATA_GO_KR_KEY(커밋 안 함). 출력하지 않는다.
  공공데이터포털 계정(15058644 활용신청 2026-11-18 승인)의 일반 인증키다. sanjae-comwel MCP 의 SANJAE_SERVICE_KEY 와는
  다른 키라 그 키로는 SERVICE_KEY_IS_NOT_REGISTERED_ERROR 가 난다(11-18 확인).
- 약국은 2만 5천 곳이라 첫 지오코딩이 오래 걸린다 — 캐시에 쌓이니 끊겨도 다시 실행하면 이어받는다.
- 좌표는 build_data.py 의 지오코더·캐시(tools/geocode_cache.json)를 그대로 쓴다.
- 받은 원자료는 raw/api_<기능>_<날짜>.json 에 남긴다(다음 갱신 때 대조용).
"""
import json, os, re, sys, threading, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import CACHE, ROOT, clean, ctx, geocode, in_korea, load_key, region  # noqa: E402

BASE = "https://apis.data.go.kr/B490001/sjHptMcalPstateInfoService/"
OPS = {"pharm": "getSjJijeongyakgukChakgiList", "rehab": "getSjBoheomJhCftHptPstateList"}
OUT_R = ROOT / "data" / "rehab.json"   # 작다 — 화면이 처음부터 읽어 지정의료기관에 표시를 붙인다
OUT_P = ROOT / "data" / "pharm.json"   # 크다(약 3MB) — 「지정약국 함께 보기」를 켤 때만 읽는다
HOSP = ROOT / "data" / "hospitals.json"


def api_key():
    k = os.environ.get("DATA_GO_KR_KEY")
    if not k:
        m = re.search(r"^DATA_GO_KR_KEY=(\S+)", (ROOT / ".env.local").read_text(encoding="utf-8-sig"), re.M)
        k = m and m.group(1)
    if not k:
        sys.exit("인증키가 없다: .env.local 에 DATA_GO_KR_KEY=<공공데이터포털 일반 인증키>")
    return k


def fetch(op, key, rows=1000):
    """모든 쪽을 받는다. 오류 응답(HTTP 200 에 resultCode 를 실어 보내는 경우 포함)은 멈춘다."""
    items, page, total = [], 1, None
    while True:
        q = urllib.parse.urlencode({"serviceKey": key, "numOfRows": rows, "pageNo": page})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(BASE + op + "?" + q, timeout=30, context=ctx) as r:
                    body = r.read().decode("utf-8")
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode("utf-8", "replace")
                sys.exit(f"{op} HTTP {e.code}: {re.sub(r'<[^>]+>', ' ', msg).split()[:8]}")
            except OSError:
                if attempt == 3:
                    raise
                time.sleep(3 * 2 ** attempt)
        root = ET.fromstring(body)
        code = root.findtext(".//resultCode") or root.findtext(".//returnReasonCode")
        if code not in ("00", "0", "000"):
            sys.exit(f"{op} 오류 {code}: {root.findtext('.//resultMsg') or root.findtext('.//errMsg')}")
        total = int(root.findtext(".//totalCount") or 0)
        got = [{c.tag: (c.text or "").strip() for c in it} for it in root.iter("item")]
        items += got
        if not got or len(items) >= total:
            return items, total
        page += 1


def main(no_geocode=False):
    key = api_key()
    today = date.today().isoformat()
    data = {}
    for name, op in OPS.items():
        items, total = fetch(op, key)
        if len(items) != total:
            sys.exit(f"{op}: 받은 {len(items)}건 ≠ totalCount {total}")
        (ROOT / "raw").mkdir(exist_ok=True)
        (ROOT / "raw" / f"api_{name}_{today.replace('-', '')}.json").write_text(
            json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
        data[name] = items
        print(f"{name}: {total}건 · 칸 {sorted(items[0]) if items else '-'}", flush=True)

    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    cache = {k: v for k, v in cache.items() if v}
    addrs = [re.sub(r"\s+", " ", it.get("addr", "")).strip() for v in data.values() for it in v]
    todo = [] if no_geocode else list(dict.fromkeys(a for a in addrs if a and a not in cache))
    print(f"새로 찾을 주소 {len(todo)}개", flush=True)
    if todo:
        vkey, lock, errors = load_key(), threading.Lock(), []

        def work(a):
            try:
                pt = geocode(a, vkey)
            except Exception as e:
                with lock:
                    errors.append(f"{a} ({e})")
                return
            with lock:
                cache[a] = pt
                if len(cache) % 100 == 0:
                    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        try:
            with ThreadPoolExecutor(4) as ex:
                list(ex.map(work, todo))
        finally:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        for e in errors[:20]:
            print("  오류:", e)

    def place(it):
        a = re.sub(r"\s+", " ", it.get("addr", "")).strip()
        pt = cache.get(a)
        ok = in_korea(pt)
        sido, sgg = region((pt or {}).get("refined") or clean(a))
        if not sido:
            sido, sgg = region(clean(a))
        return a, sido, sgg, (round(pt["lat"], 6) if ok else None), (round(pt["lng"], 6) if ok else None)

    pharm, pfail = [], 0
    for it in data["pharm"]:
        a, sido, sgg, lat, lng = place(it)
        pfail += lat is None
        pharm.append([it.get("hospitalNm", ""), a, it.get("tel", ""), sido, sgg, lat, lng])
    # 재활인증: 지정의료기관 목록과 기호(hospitalNo ↔ 의료기관기호)로 맞춘다. 맞으면 화면은 그 기관에 표시만 붙인다.
    hcodes = set()
    if HOSP.exists():
        h = json.loads(HOSP.read_text(encoding="utf-8"))
        ci = h["meta"]["fields"].index("code")
        hcodes = {r[ci] for r in h["rows"]}
    rehab, rmatch, rfail = [], 0, 0
    for it in data["rehab"]:
        a, sido, sgg, lat, lng = place(it)
        code = it.get("hospitalNo", "")
        rmatch += code in hcodes
        rfail += lat is None
        rehab.append([code, it.get("hospitalNm", ""), it.get("gtCdNm1", ""), a, it.get("tel", ""), sido, sgg, lat, lng])
    src = "공공데이터포털 data.go.kr/data/15058644 (근로복지공단_산재병원 의료 현황정보)"
    dump = lambda p, o: p.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    dump(OUT_R, {"meta": {"source": src, "fetched": today, "count": len(rehab), "matched": rmatch,
                          "fields": ["code", "name", "gtype", "addr", "tel", "sido", "sgg", "lat", "lng"]}, "rows": rehab})
    dump(OUT_P, {"meta": {"source": src, "fetched": today, "count": len(pharm), "geocoded": len(pharm) - pfail,
                          "fields": ["name", "addr", "tel", "sido", "sgg", "lat", "lng"]}, "rows": pharm})
    print(f"rehab.json {OUT_R.stat().st_size // 1024}KB · 재활인증 {len(rehab)}(지정 목록 기호 일치 {rmatch}, 좌표 실패 {rfail})")
    print(f"pharm.json {OUT_P.stat().st_size // 1024}KB · 약국 {len(pharm)}(좌표 실패 {pfail})")
    for r in rehab:
        if r[0] not in hcodes:
            print("  재활인증 중 지정 목록에 없는 기관:", r[1], r[3])
    from collections import Counter
    print("재활인증 병원구분:", dict(Counter(r[2] for r in rehab)))

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main("--no-geocode" in sys.argv[1:])
