"""게시 전 정적 검사 — 브라우저 없이, 설치할 것 없이(파이썬 기본 기능만).

    py -3 tools/check.py

푸시하기 전에 매번 돌린다. 하나라도 틀리면 종료코드 1. 지금까지 사람이 기억해서 챙기던 것을 묶었다
(인계서 9절 「주의사항」). 화면이 실제로 뜨는지는 여기서 못 본다 — README 「브라우저 점검」 목록을 따른다.

  1. 판 번호   index.html 의 ?v= 와 app.js 의 VER 가 모두 같은가(Pages 캐시 10분 — 어긋나면 옛 파일을 받는다)
  2. 자료      data/*.json 이 열리고 행 길이가 fields 와 맞으며, 좌표가 한국 범위 안인가
  3. 숫자      안내 글(index.html·루트 화면·시도 페이지)의 「N곳」이 자료에서 센 값과 같은가
  4. 주소      시도 slug 17개·sitemap.xml 이 그대로인가(공모전 원고에 주소가 실렸다 — 바꾸지 말 것)
  5. 지울 수 없는 것  구글·네이버 확인 태그 · 하단 비공식 문구 · 루트에 자동 넘김이 다시 들어오지 않았나
  6. 키        .env.local 의 값이 git 이 올릴 파일 어디에도 없는가 · config.js 에는 브이월드 키 하나뿐인가
  7. 문법      node 가 있으면 app.js 문법 검사(node --check)
"""
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent / "himnuszkorea.github.io"   # 루트 사이트(같은 PC 에 있을 때만 검사)
sys.path.insert(0, str(ROOT / "tools"))
from build_pages import SIDO, BASE  # noqa: E402 — slug 의 단일 원본

GOOGLE_TAG = "9H2Zevn35TsmGJkGda8l3bd3kjGedwvUifgGAZlFWgs"
NAVER_TAG = "bf1c7e44def9676c2714d93414ff11459d35865f"

fails, notes = [], []


def ok(cond, msg):
    if not cond:
        fails.append(msg)
    return cond


def read(p):
    return Path(p).read_text(encoding="utf-8")


def load(name):
    return json.loads(read(ROOT / "data" / f"{name}.json"))


index = read(ROOT / "index.html")
app = read(ROOT / "app.js")

# 1. 판 번호 ─────────────────────────────────────────────
vs = re.findall(r"\?v=([0-9a-z]+)", index)
ver = re.search(r'VER\s*=\s*"([^"]+)"', app)
ok(len(vs) >= 3, f"[판] index.html 의 ?v= 가 {len(vs)}곳뿐(3곳이어야 함)")
ok(ver, "[판] app.js 에서 VER 를 못 찾음")
if ver:
    ok(set(vs) == {ver.group(1)}, f"[판] ?v= {sorted(set(vs))} ≠ VER {ver.group(1)} — 넷을 함께 올릴 것")

# 2. 자료 ────────────────────────────────────────────────
H, P, R = load("hospitals"), load("pharm"), load("rehab")
for name, d in (("hospitals", H), ("pharm", P), ("rehab", R)):
    F = d["meta"]["fields"]
    bad = [i for i, r in enumerate(d["rows"]) if len(r) != len(F)]
    ok(not bad, f"[자료] {name}.json 행 {len(bad)}개가 fields({len(F)}칸)와 길이가 다름")
    la, ln = F.index("lat"), F.index("lng")
    out = [r for r in d["rows"] if r[la] is not None and not (33 <= r[la] <= 39 and 124 <= r[ln] <= 132)]
    ok(not out, f"[자료] {name}.json 좌표가 한국 밖인 행 {len(out)}개")
    ok(d["meta"].get("count") == len(d["rows"]) or name == "hospitals",
       f"[자료] {name}.json meta.count {d['meta'].get('count')} ≠ 행 {len(d['rows'])}")

Fh = H["meta"]["fields"]
desig = [r for r in H["rows"] if r[Fh.index("desig")]]
hear = Counter(r[Fh.index("hk")] for r in H["rows"] if r[Fh.index("hk")] >= 0)
n_desig, n_hear, n_off = len(desig), sum(hear.values()), len(H["offices"])
n_rehab, n_pharm = len(R["rows"]), len(P["rows"])
ok(H["meta"]["count"] == n_desig, f"[자료] hospitals meta.count {H['meta']['count']} ≠ 지정기관 {n_desig}")

# 3. 숫자 ────────────────────────────────────────────────
def has(text, n, where):
    ok(f"{n:,}곳" in text, f"[숫자] {where} 에 「{n:,}곳」이 없음 — 안내 글을 자료에 맞게 고칠 것")


for n in (n_desig, n_hear, n_off, n_rehab, n_pharm):
    has(index, n, "index.html")
# 특진 종류별 내역(상급종합 33, 종합 82, 청력검사 전문 97, 공단 소속병원 8)
hk = H["meta"]["hkinds"]
for i, label in enumerate(hk):
    short = {"청력검사전문의료기관": "청력검사 전문의료기관"}.get(label, label)
    ok(f"{short} {hear[i]}" in index, f"[숫자] index.html 특진 내역에 「{short} {hear[i]}」 없음")
# 같은 숫자를 다른 값으로 적은 곳(옛 숫자)이 남았나 — 「지정의료기관 N곳」 꼴만 본다
for m in re.finditer(r"지정의료기관 ([0-9,]+)곳", index):
    ok(m.group(1) == f"{n_desig:,}", f"[숫자] index.html 에 옛 숫자 「지정의료기관 {m.group(1)}곳」")

if SITE.exists():
    root = read(SITE / "index.html")
    has(root, n_desig, "루트 화면")
    has(root, n_hear, "루트 화면")
else:
    notes.append("루트 사이트 폴더가 없어 루트 검사는 건너뜀")

# 4. 주소 ────────────────────────────────────────────────
Fs = Fh.index("sido")
slugs = {s for _, s, _ in SIDO}
have = {p.name for p in (ROOT / "r").iterdir() if p.is_dir()}
ok(have == slugs, f"[주소] r/ 폴더가 다름 — 없음 {sorted(slugs - have)} · 남는 것 {sorted(have - slugs)}")
for sido, slug, _ in SIDO:
    page = ROOT / "r" / slug / "index.html"
    if not ok(page.exists(), f"[주소] r/{slug}/index.html 없음"):
        continue
    n = sum(1 for r in desig if r[Fs] == sido)
    ok(f"{n:,}곳" in read(page), f"[숫자] r/{slug} 에 「{n:,}곳」 없음 — py -3 tools/build_pages.py 다시 돌릴 것")
locs = re.findall(r"<loc>([^<]+)</loc>", read(ROOT / "sitemap.xml"))
want = [BASE] + [f"{BASE}r/{s}/" for _, s, _ in SIDO]
ok(sorted(locs) == sorted(want), f"[주소] sitemap.xml 주소가 다름(있음 {len(locs)} · 기대 {len(want)})")

# 5. 지울 수 없는 것 ──────────────────────────────────────
ok(GOOGLE_TAG in index, "[태그] index.html 구글 확인 태그가 없음")
ok("비공식 참고용 지도" in app and "공식 서비스 아님" in app, "[문구] app.js 하단 비공식 문구가 없음(공모전 A02 — 삭제 금지)")
if SITE.exists():
    ok(NAVER_TAG in root, "[태그] 루트 네이버 확인 태그가 없음")
    ok(GOOGLE_TAG in root, "[태그] 루트 구글 확인 태그가 없음")
    code = re.sub(r"<!--.*?-->", "", root, flags=re.S)
    ok(not re.search(r'http-equiv=["\']?refresh|location\.(replace|href\s*=)|setTimeout', code, re.I),
       "[루트] 자동 넘김이 들어 있음 — 넘기지 않는 안내 화면(A안)이어야 함")

# 6. 키 ──────────────────────────────────────────────────
env = ROOT / ".env.local"
if env.exists():
    keys = [v.strip() for v in re.findall(r"^\w+=(\S+)", read(env), re.M) if len(v.strip()) >= 16]
    files = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT,
                           capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
    vw = re.search(r"^VWORLD_KEY=(\S+)", read(env), re.M)
    for f in filter(None, files):
        p = ROOT / f
        if p.suffix.lower() in {".png", ".ico", ".gz"} or not p.is_file() or p.stat().st_size > 20_000_000:
            continue
        try:
            t = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for k in keys:
            if k in t and not (f == "config.js" and vw and k == vw.group(1)):
                fails.append(f"[키] {f} 에 .env.local 의 키 값이 들어 있음 — 커밋 금지")  # 값은 찍지 않는다
    ign = subprocess.run(["git", "check-ignore", "-q", ".env.local"], cwd=ROOT).returncode == 0
    ok(ign, "[키] .env.local 이 git 제외가 아님")
else:
    notes.append(".env.local 이 없어 키 검사는 건너뜀")
cfg = read(ROOT / "config.js")
ok(re.findall(r"window\.(\w+)\s*=", cfg) == ["VWORLD_KEY"], "[키] config.js 에 VWORLD_KEY 말고 다른 값이 있음")

# 7. 문법 ────────────────────────────────────────────────
node = shutil.which("node")
if node:
    r = subprocess.run([node, "--check", str(ROOT / "app.js")], capture_output=True, text=True, encoding="utf-8")
    ok(r.returncode == 0, f"[문법] app.js: {r.stderr.strip()[:300]}")
else:
    notes.append("node 가 없어 app.js 문법 검사는 건너뜀")

# ── 결과 ──────────────────────────────────────────────────
print(f"판 {ver.group(1) if ver else '?'} · 지정 {n_desig:,} · 특진 {n_hear} · 소속기관 {n_off} · "
      f"재활인증 {n_rehab} · 약국 {n_pharm:,} · 시도 페이지 {len(have)}")
for n in notes:
    print("  (참고)", n)
if fails:
    print(f"\n✗ {len(fails)}건 실패")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✓ 정적 검사 통과 — 화면을 고쳤으면 README 「브라우저 점검」도 할 것")
