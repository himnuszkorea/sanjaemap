// 브라우저 점검 — 페이지 안에서 도는 함수 하나(설치할 것 없음). README 「브라우저 점검」 절차대로
// playwright MCP 의 browser_evaluate 에 이 파일 내용을 통째로 function 으로 넘긴다.
// 화면 폭에 따라 PC(>760px) / 휴대폰(≤760px) 항목을 고른다. 주소에 ?id= 가 있으면 그 기관 팝업도 본다.
// 결과: { ok, width, results:[{name, ok, detail}] } — ok:false 가 하나라도 있으면 게시하지 않는다.
// 페이지 상태를 바꾸므로(약국 켜기·탭 전환) 점검이 끝나면 새로 고침해서 쓴다.
async () => {
  const R = [], W = innerWidth, mobile = W <= 760;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 200) { const v = fn(); if (v) return v; await sleep(200); } return fn(); };
  const add = (name, ok, detail = "") => R.push({ name, ok: !!ok, detail: String(detail) });
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && r.left >= -1 && r.right <= W + 1; };
  const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const inView = el => { const r = el.getBoundingClientRect(); return { ok: r.left >= -1 && r.right <= W + 1, l: Math.round(r.left), r: Math.round(r.right) }; };

  // 1. 첫 화면이 뜨는가
  const marks = await until(() => document.querySelectorAll(".leaflet-marker-icon").length);
  add("지도 표식이 뜬다", marks > 0, `${marks}개`);
  const rows = await until(() => document.querySelectorAll("#list li").length);
  add("목록이 채워진다", rows > 0, `${rows}행`);
  add("하단 비공식 문구", /비공식 참고용 지도/.test($("#foot")?.textContent || ""));
  add("재활인증 건수 표시", /\d/.test($("#rehabN")?.textContent || ""), $("#rehabN")?.textContent);
  add("가로 넘침 없음(첫 화면)", overflow() <= 0, `${overflow()}px`);

  // 2. 화면 배치 — 휴대폰은 탭마다, PC 는 한 번
  const quickItems = { "목적 버튼 3개": () => [...document.querySelectorAll("[data-purpose]")].filter(vis).length === 3,
    "내 위치 단추": () => vis($("#gps")), "재활인증 토글": () => vis($("#rehabOnly")?.closest("label")),
    "약국 토글": () => vis($("#pharmOn")?.closest("label")), "산재 처음이세요? 단추": () => vis($("#firstBtn")) };
  if (mobile) {
    $('#tabs [data-tab="map"]').click(); await sleep(400);
    for (const [k, f] of Object.entries(quickItems)) add(`[지도 탭] ${k} 보임`, f());
    const mh = $("#map").getBoundingClientRect().height;
    add("[지도 탭] 지도 높이 ≥ 250px", mh >= 250, `${Math.round(mh)}px`);
    add("[지도 탭] 가로 넘침 없음", overflow() <= 0, `${overflow()}px`);
    $('#tabs [data-tab="list"]').click(); await sleep(400);
    add("[목록 탭] 목록 보임", vis($("#list")));
    add("[목록 탭] 지도 숨김", !vis($("#map")));
    add("[목록 탭] 가로 넘침 없음", overflow() <= 0, `${overflow()}px`);
    $('#tabs [data-tab="map"]').click(); await sleep(400);
  } else {
    for (const [k, f] of Object.entries(quickItems)) add(`[PC] ${k} 보임`, f());
    add("[PC] 지도·목록 함께 보임", vis($("#map")) && vis($("#side")));
    add("[PC] 휴대폰 탭 숨김", !vis($("#tabs")));
  }

  // 3. 「산재 처음이세요?」 창이 화면 안에 들어오는가
  $("#firstBtn").click(); await sleep(300);
  const dlg = $("#first"), dr = dlg.getBoundingClientRect();
  add("「산재 처음이세요?」 창 열림", dlg.open);
  add("창이 화면 높이 안", dr.height <= innerHeight + 1 && dr.top >= -1, `높이 ${Math.round(dr.height)} / 화면 ${innerHeight}`);
  add("창이 화면 폭 안", inView(dlg).ok, JSON.stringify(inView(dlg)));
  dlg.close();

  // 4. ?id= 로 들어오면 그 기관 팝업이 열리는가
  if (new URLSearchParams(location.search).get("id")) {
    const pop = await until(() => $(".leaflet-popup"));
    add("?id= 팝업 열림", pop);
    if (pop) add("?id= 팝업이 화면 폭 안", inView(pop).ok, JSON.stringify(inView(pop)));
  }

  // 5. 약국 켜기 → 자료가 실리고, 약국 팝업이 화면 폭 안에 들어오는가
  $("#pharmOn").click();
  const pn = await until(() => /곳|못함/.test($("#pharmN").textContent) && $("#pharmN").textContent, 20000);
  add("약국 자료 실림", /곳/.test(pn || ""), pn);
  if (mobile) { $('#tabs [data-tab="list"]').click(); await sleep(300); }
  // 목록에 약국 행이 나올 때까지 「더 보기」를 누른다(지정기관 뒤에 붙는다)
  let ph = null;
  for (let i = 0; i < 40 && !(ph = [...document.querySelectorAll("#list li.ph")].find(li => !li.querySelector(".tag.w"))); i++) {
    const more = [...document.querySelectorAll("#side button, #list button")].find(b => /더 보기/.test(b.textContent));
    if (!more) break; more.click(); await sleep(150);
  }
  add("목록에 약국 행", ph);
  if (ph) {
    ph.click();
    const pop = await until(() => { const p = $(".leaflet-popup"); return p && /지정약국|약국/.test(p.textContent) && p; });
    add("약국 팝업 열림", pop);
    if (pop) { await sleep(500); add("약국 팝업이 화면 폭 안", inView(pop).ok, JSON.stringify(inView(pop))); }
  }
  add("가로 넘침 없음(약국 켠 뒤)", overflow() <= 0, `${overflow()}px`);

  const bad = R.filter(r => !r.ok);
  return { ok: bad.length === 0, width: W, url: location.href, failed: bad, results: R };
}
