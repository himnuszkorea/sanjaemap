"""data/hospitals.json → 시도별 고정 목록 페이지 r/<slug>/index.html 17개 + sitemap.xml.

지도 앱은 화면 글이 거의 없어 「서울 산재 지정병원」 같은 검색에서 들어올 길이 없다(2026-10-21 인계 메모 3절).
스크립트 없이 읽히는 정적 목록을 만들어 검색엔진이 찾게 한다. Pages 는 빌드가 없으니 생성물도 커밋한다.

    py -3 tools/build_pages.py

숫자·기준일은 hospitals.json 에서 센다 — 페이지에 손으로 박지 않는다. slug 는 주소라 바꾸지 말 것.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "hospitals.json"
BASE = "https://himnuszkorea.github.io/sanjaemap/"
SRC_URL = "https://www.data.go.kr/data/3044320/fileData.do"

# (hospitals.json 의 sido, 주소 slug, 정식 이름) — slug 는 공개 주소라 바꾸지 않는다
SIDO = [
    ("서울", "seoul", "서울특별시"), ("부산", "busan", "부산광역시"), ("대구", "daegu", "대구광역시"),
    ("인천", "incheon", "인천광역시"), ("광주", "gwangju", "광주광역시"), ("대전", "daejeon", "대전광역시"),
    ("울산", "ulsan", "울산광역시"), ("세종", "sejong", "세종특별자치시"), ("경기", "gyeonggi", "경기도"),
    ("강원", "gangwon", "강원특별자치도"), ("충북", "chungbuk", "충청북도"), ("충남", "chungnam", "충청남도"),
    ("전북", "jeonbuk", "전북특별자치도"), ("전남", "jeonnam", "전라남도"), ("경북", "gyeongbuk", "경상북도"),
    ("경남", "gyeongnam", "경상남도"), ("제주", "jeju", "제주특별자치도"),
]
HSHORT = {"공단 소속병원": "공단병원", "상급종합병원": "상급종합", "종합병원": "종합", "청력검사전문의료기관": "청력검사 전문"}

CSS = """
:root{--bg:#f6f7f9;--panel:#fff;--ink:#1b2a4a;--muted:#5b6578;--line:#dfe3ea;--gold:#c8963e;--hear:#8a6420}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#11151c;--panel:#1a2029;--ink:#e7ebf2;--muted:#9aa4b5;--line:#2c3440;--gold:#d9a955;--hear:#e0b46a}}
:root[data-theme="dark"]{--bg:#11151c;--panel:#1a2029;--ink:#e7ebf2;--muted:#9aa4b5;--line:#2c3440;--gold:#d9a955;--hear:#e0b46a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:14px;line-height:1.6}
main{max-width:1000px;margin:0 auto;padding:16px}
a{color:inherit}
header{border-top:4px solid var(--gold);background:var(--panel);padding:16px;border-radius:0 0 8px 8px}
header .brand{font-weight:700;text-decoration:none}
h1{font-size:22px;margin:6px 0 8px;line-height:1.35}
h2{font-size:17px;margin:28px 0 8px;scroll-margin-top:8px}
p.lead{margin:0;color:var(--muted)}
a.map{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:6px;background:var(--gold);color:#fff;font-weight:700;text-decoration:none}
nav{margin:14px 0;font-size:13px}
nav a{white-space:nowrap}
.tbl{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{background:var(--bg);white-space:nowrap}
td.tel,td.kind,td.hear{white-space:nowrap}
td.hear{color:var(--hear)}
td.tel a{color:inherit}
a.pin{font-size:12px;color:var(--muted);white-space:nowrap}
.out{color:var(--muted);font-size:12px}
footer{margin:32px 0 16px;font-size:12px;color:var(--muted)}
@media (max-width:640px){table{min-width:640px}h1{font-size:19px}}
"""


def tel_link(t):
    """휴대폰에서 바로 걸리게 — 화면의 app.js telHref 와 같은 규칙(내선 등 넷째 토막은 뺀다)."""
    if not t:
        return ""
    digits = re.sub(r"[^0-9]", "", "".join(t.split("-")[:3]))
    return f'<a href="tel:{digits}">{escape(t)}</a>' if digits else escape(t)


def page(sido, slug, full, rows, meta, kinds, hkinds):
    asof, hasof = meta["asof"], meta.get("hearing_asof", "")
    n_des = sum(1 for r in rows if r["desig"])
    n_only = len(rows) - n_des
    n_hear = sum(1 for r in rows if r["hk"] >= 0)
    by_sgg = defaultdict(list)
    for r in rows:
        by_sgg[r["sgg"] or "(시·군·구 미상)"].append(r)
    sggs = sorted(by_sgg)
    title = f"{sido} 산재병원·산재 지정의료기관 목록 {n_des:,}곳 | 산재맵(산재지도)"
    desc = (f"{full} 산재보험 지정의료기관 {n_des:,}곳(근로복지공단 자료, {asof} 기준)을 시·군·구별로 정리했습니다. "
            f"기관명·주소·전화번호와 소음성 난청 특진 여부를 확인하고 산재맵(산재지도)에서 가까운 산재병원을 찾으세요.")
    url = f"{BASE}r/{slug}/"
    out = [f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{url}">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="산재맵">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}og-image.png">
<style>{CSS}</style>
</head>
<body>
<main>
<header>
  <a class="brand" href="../../">산재맵</a>
  <h1>{escape(sido)} 산재보험 지정의료기관(산재병원) {n_des:,}곳</h1>
  <p class="lead">근로복지공단 「산재보험 지정의료기관 현황정보」(공공데이터포털, {asof} 기준)와 소음성 난청 특진 의뢰기관 현황({hasof})을
     시·군·구별로 정리한 목록입니다. 특진 의뢰기관은 {n_hear:,}곳{f"이고, 그중 {n_only:,}곳은 지정의료기관 목록에는 없어 따로 표시했습니다" if n_only else "입니다"}.
     지정·해지가 수시로 있으니 방문 전에 병원이나 근로복지공단(1588-0075)에 확인하세요.</p>
  <a class="map" href="../../?sido={escape(sido)}">산재맵 지도에서 {escape(sido)} 보기</a>
</header>
<nav aria-label="시·군·구">시·군·구: """ + " · ".join(
        f'<a href="#{escape(g)}">{escape(g)}({len(by_sgg[g])})</a>' for g in sggs) + "</nav>"]
    for g in sggs:
        lst = sorted(by_sgg[g], key=lambda r: (not r["desig"], r["name"]))
        out.append(f'<h2 id="{escape(g)}">{escape(sido)} {escape(g)} {len(lst):,}곳</h2>\n<div class="tbl"><table>\n'
                   "<thead><tr><th>기관명</th><th>종류(이름 추정)</th><th>주소</th><th>전화</th><th>소음성 난청 특진</th></tr></thead><tbody>")
        for r in lst:
            kind = escape(kinds[r["kind"]]) if r["desig"] else '<span class="out">지정 목록 밖</span>'
            hear = "특진(" + escape(HSHORT.get(hkinds[r["hk"]], hkinds[r["hk"]])) + ")" if r["hk"] >= 0 else ""
            tel = tel_link(r["tel"]) + (f" · 특진 {tel_link(r['htel'])}" if r["htel"] else "")
            # 기관별 「지도」 — 산재맵이 ?id=기호 로 그 기관 팝업을 연다(위치 미확인은 목록으로)
            name = (f'{escape(r["name"])} <a class="pin" href="../../?id={quote(r["code"])}">지도</a>' if r["lat"] is not None
                    else f'{escape(r["name"])} <span class="out">위치 미확인</span>')
            out.append(f'<tr><td>{name}</td><td class="kind">{kind}</td><td>{escape(r["addr"])}</td>'
                       f'<td class="tel">{tel}</td><td class="hear">{hear}</td></tr>')
        out.append("</tbody></table></div>")
    out.append('<nav aria-label="다른 지역">다른 지역: ' + " · ".join(
        (f"<strong>{k}</strong>" if s == slug else f'<a href="../{s}/">{k}</a>') for k, s, _ in SIDO) + "</nav>")
    out.append(f"""<footer>개인이 공공데이터로 만든 참고용 목록이며 근로복지공단 공식 서비스가 아닙니다 ·
자료: 공공데이터포털 <a href="{SRC_URL}">근로복지공단 산재보험 지정의료기관 현황정보</a>({asof} 기준) ·
종류는 원자료에 없어 기관명으로 추정했습니다 · <a href="../../">산재맵 지도</a></footer>
</main>
</body>
</html>
""")
    return "\n".join(out), n_des, n_only


def main():
    d = json.loads(DATA.read_text(encoding="utf-8"))
    meta, F = d["meta"], d["meta"]["fields"]
    rows = [dict(zip(F, r)) for r in d["rows"]]
    known = {s for s, _, _ in SIDO}
    stray = Counter(r["sido"] for r in rows if r["sido"] not in known)
    if stray:
        sys.exit(f"시도 17곳 밖의 행이 있다 — SIDO 표를 고칠 것: {dict(stray)}")
    tot_des = tot_only = 0
    for sido, slug, full in SIDO:
        html, n_des, n_only = page(sido, slug, full, [r for r in rows if r["sido"] == sido],
                                   meta, meta["kinds"], meta["hkinds"])
        p = ROOT / "r" / slug / "index.html"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(html, encoding="utf-8", newline="\n")
        tot_des += n_des
        tot_only += n_only
        print(f"{sido:3} {slug:10} 지정 {n_des:5,} + 특진만 {n_only:3}")
    today = date.today().isoformat()
    urls = [(BASE, "1.0")] + [(f"{BASE}r/{s}/", "0.6") for _, s, _ in SIDO]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod><changefreq>monthly</changefreq><priority>{pr}</priority></url>\n"
                  for u, pr in urls) + "</urlset>\n", encoding="utf-8", newline="\n")
    ok = tot_des + tot_only == len(rows) and tot_des == sum(r["desig"] for r in rows)
    print(f"합계 {tot_des + tot_only:,} = 지정 {tot_des:,} + 특진만 {tot_only} · 전체 행 {len(rows):,} → {'일치' if ok else '불일치!'}")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
