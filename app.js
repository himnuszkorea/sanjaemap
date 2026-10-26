// 산재맵(산재보험 지정의료기관 검색지도) — data/hospitals.json(tools/build_data.py 생성)을 읽어 그린다.
// 표식: 작은 동그라미 = 산재보험 지정의료기관(색=종류) · 큰 동그라미 = 소음성 난청 청력 특진 의뢰기관(색=특진 종류, 지정 목록 밖은 점선 테두리) · 보라 네모 = 공단 소속기관.
// 출발지·거리·길찾기·브이월드 검색·소속기관 표시는 청력 특진 지도(gj-hearing-clinic-map/index.html)와 같은 방식이다.
"use strict";
const VWORLD_KEY = window.VWORLD_KEY || "";
const VER = "20261027a";  // index.html 의 ?v= 와 같이 올린다(Pages 캐시 10분)
const HEARING_MAP = "https://gj-hearing-clinic-map.vercel.app/";
const REPORT = "https://github.com/himnuszkorea/sanjaemap/issues/new";  // 오류 제보 창구
const SIDO_ORDER = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const LIST_STEP = 200;  // 목록은 200곳씩 그린다(6천여 곳을 한 번에 그리면 느리다)
const HSHORT = {"공단 소속병원": "공단 소속병원", "상급종합병원": "상급종합", "종합병원": "종합병원", "청력검사전문의료기관": "청력검사 전문"};

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const $ = id => document.getElementById(id);
// 검색 비교용: 전각 괄호·전각 공백을 반각으로(NFKC), 빈칸은 뺀다 — '인제대학교상계백병원'으로도 '인제대학교 상계백병원'이 찾힌다
const norm = s => String(s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const SIDO_SHORT = {"서울특별시":"서울","부산광역시":"부산","대구광역시":"대구","인천광역시":"인천","광주광역시":"광주","대전광역시":"대전",
  "울산광역시":"울산","세종특별자치시":"세종","경기도":"경기","강원특별자치도":"강원","충청북도":"충북","충청남도":"충남",
  "전북특별자치도":"전북","전라남도":"전남","경상북도":"경북","경상남도":"경남","제주특별자치도":"제주"};

// ── 지도 ───────────────────────────────────────────
const map = L.map("map", {minZoom: 6, maxZoom: 19, zoomSnap: 0.5, preferCanvas: true}).setView([36.3, 127.8], 7);
const vworld = L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`, {
  minZoom: 6, maxZoom: 19, attribution: "© 국토교통부 브이월드"
}).addTo(map);
// 브이월드 타일이 연달아 실패하면(장애·키 문제) 빈 화면 대신 OpenStreetMap 으로 바꾼다
let tileOk = 0, tileErr = 0;
vworld.on("tileload", () => tileOk++);
vworld.on("tileerror", () => {
  if (++tileErr < 4 || tileErr <= tileOk) return;
  map.removeLayer(vworld); vworld.off();
  map.attributionControl.removeAttribution(vworld.getAttribution());
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 6, maxZoom: 19, attribution: "© OpenStreetMap contributors (브이월드 장애 대체)"
  }).addTo(map);
});
// 같은 좌표 기관을 묶은 표식(options.n)은 그 수만큼 센다 — 아니면 묶음 숫자가 실제 기관 수보다 작게 나온다
const childN = g => g.getAllChildMarkers().reduce((s, m) => s + (m.options.n || 1), 0);
let pendingFocus = null;  // ?id= 로 열 때: 묶음에 표식이 다 들어간 뒤 그 기관을 연다(chunkedLoading 은 나눠서 넣는다)
const cluster = L.markerClusterGroup({showCoverageOnHover: false, maxClusterRadius: 50, chunkedLoading: true,
  disableClusteringAtZoom: 17,
  iconCreateFunction: g => {
    const n = childN(g);
    return L.divIcon({html: `<div><span>${n}</span></div>`, className: `marker-cluster marker-cluster-${n < 10 ? "small" : n < 100 ? "medium" : "large"}`,
                      iconSize: L.point(40, 40)});
  },
  chunkProgress: (done, total) => {
    // 바로 열지 않고 한 박자 미룬다 — 특진 묶음(hcluster)은 이 묶음 다음에 채워진다
    if (done === total && pendingFocus) { const c = pendingFocus; pendingFocus = null; setTimeout(() => focus(c)); }
  }});
// 특진 기관은 지정의료기관 묶음과 섞이지 않게 따로 묶고, 묶음 표식도 금색으로 구분한다
const hcluster = L.markerClusterGroup({showCoverageOnHover: false, maxClusterRadius: 40, disableClusteringAtZoom: 14,
  iconCreateFunction: g => L.divIcon({className: "", html: `<div class="hcl">${childN(g)}</div>`, iconSize: [34, 34]})});
const ofcLayer = L.layerGroup();  // 78곳이라 묶지 않는다
map.addLayer(cluster); map.addLayer(hcluster); map.addLayer(ofcLayer);

// ── 휴대폰: 한 손가락은 페이지 스크롤, 지도는 두 손가락 ─────────
// 지도가 화면 폭 전체라 한 손가락 끌기를 지도가 가져가면 페이지를 내릴 곳이 없다.
// 끌기를 끄면 Leaflet 이 touch-action 을 pan-x pan-y 로 풀어 브라우저가 스크롤하고, 두 손가락 손모음(touchZoom)으로 이동·확대한다.
const mobile = matchMedia("(max-width:760px)");
const hint = document.createElement("div");
hint.id = "mapHint"; hint.textContent = "지도는 두 손가락으로 움직이세요";
$("map").appendChild(hint);
let hintTimer = 0;
$("map").addEventListener("touchstart", e => {
  if (!mobile.matches || e.touches.length !== 1 || e.target.closest(".leaflet-control, .leaflet-popup")) return;
  hint.classList.add("on");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.remove("on"), 1500);
}, {passive: true});
$("map").addEventListener("touchmove", e => { if (e.touches.length > 1) hint.classList.remove("on"); }, {passive: true});
const setDrag = () => mobile.matches ? map.dragging.disable() : map.dragging.enable();
setDrag(); mobile.addEventListener("change", setDrag);

// 떠 있는 버튼: 지도가 화면 밖이면 「▲ 지도·검색」, 목록에서 기관을 눌러 지도로 올라왔으면 「▼ 목록으로」
const jump = $("jump");
let backY = null, mapSeen = true;
function setJump(){
  jump.textContent = backY != null ? "▼ 목록으로" : "▲ 지도·검색";
  jump.hidden = backY == null && mapSeen;
}
new IntersectionObserver(([e]) => { mapSeen = e.isIntersecting; if (!mapSeen) backY = null; setJump(); }).observe($("map"));
jump.onclick = () => {
  if (backY != null) { scrollTo(0, backY); backY = null; }
  else scrollTo(0, 0);
  setJump();
};

// ── 출발지와 직선거리 ───────────────────────────────
let origin = null, sortBy = "name";
const rad = d => d * Math.PI / 180;
function kmFrom(c){
  if (!origin || c.lat == null) return null;
  const a = Math.sin(rad(c.lat - origin.lat) / 2) ** 2 +
            Math.cos(rad(origin.lat)) * Math.cos(rad(c.lat)) * Math.sin(rad(c.lng - origin.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
const fmtKm = d => d < 1 ? `${Math.round(d * 1000)}m` : `${d < 10 ? d.toFixed(1) : Math.round(d)}km`;

// 길찾기 링크. 카카오는 WGS84 좌표를 그대로, 네이버 웹지도는 EPSG:3857(웹 메르카토르) 좌표를 받는다.
const label = s => String(s).replace(/[,/]/g, " ").trim();
const merc = (lat, lng) => [lng * 20037508.34 / 180,
  Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180].map(v => v.toFixed(1));
function kakaoUrl(c){
  const to = `to/${encodeURIComponent(label(c.name))},${c.lat},${c.lng}`;
  return "https://map.kakao.com/link/" +
    (origin ? `from/${encodeURIComponent(label(origin.name))},${origin.lat},${origin.lng}/` : "") + to;
}
function naverUrl(c){
  const seg = (p, n) => `${merc(p.lat, p.lng).join(",")},${encodeURIComponent(label(n))},,`;
  return `https://map.naver.com/p/directions/${origin ? seg(origin, origin.name) : "-"}/${seg(c, c.name)}/-/car`;
}
const telHref = t => "tel:" + String(t).split("-").slice(0, 3).join("").replace(/[^0-9]/g, "");
const routeLinks = c => c.lat == null ? "" :
  `<a class="kakao" href="${esc(kakaoUrl(c))}" target="_blank" rel="noopener">카카오 길찾기</a>` +
  `<a class="naver" href="${esc(naverUrl(c))}" target="_blank" rel="noopener">네이버 길찾기</a>`;
const goLinks = c =>
  `<div class="go">${c.tel ? `<a class="tel" href="${esc(telHref(c.tel))}">전화 ${esc(c.tel)}</a>` : ""}${routeLinks(c)}</div>`;

// 기관 링크(?id=기호) 공유 — 팝업 아래 작은 줄. 기관별 제보 링크는 두지 않는다(목록은 매년 갱신 때 일괄 정리, 10-22 사용자 결정)
const shareUrl = c => `${location.origin}${location.pathname}?id=${encodeURIComponent(c.code)}`;
const subLinks = c => `<div class="pop-sub"><button type="button" class="share" data-code="${esc(c.code)}">링크 공유</button></div>`;
document.addEventListener("click", async e => {
  const b = e.target.closest("button.share");
  if (!b) return;
  const c = H.find(x => x.code === b.dataset.code), url = shareUrl(c);
  try {
    if (navigator.share && mobile.matches) await navigator.share({title: `${c.name} — 산재맵`, url});
    else { await navigator.clipboard.writeText(url); b.textContent = "주소 복사됨"; }
  } catch (err) {
    if (err.name !== "AbortError") prompt("이 주소를 복사하세요", url);
  }
});

// ── 자료 읽기 ──────────────────────────────────────
let H = [], KINDS = [], HKINDS = [], META = {}, offices = [], sites = [], allBounds = null;
const OKINDS = [
  {k: "지역본부·지사", m: ["공단 본부", "지역본부", "지사"]},
  {k: "질병판정위원회", m: ["업무상질병판정위원회"]},
  {k: "특고센터", m: ["특수형태근로종사자센터"]}
];
const OLABEL = {"공단 본부": "본부", "지역본부": "지역본부", "지사": "지사", "특수형태근로종사자센터": "특고센터", "업무상질병판정위원회": "질병판정위"};
const OLETTER = {"공단 본부": "공", "지역본부": "본", "지사": "지", "특수형태근로종사자센터": "특", "업무상질병판정위원회": "질"};

fetch(`data/hospitals.json?v=${VER}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init)
  .catch(err => { $("sub").hidden = false; $("sub").textContent = `자료를 불러오지 못했습니다(${err.message}).`; });

function init(d){
  META = d.meta; KINDS = d.meta.kinds; HKINDS = d.meta.hkinds;
  const F = d.meta.fields;
  H = d.rows.map(r => Object.fromEntries(F.map((f, i) => [f, r[i]])));
  H.forEach(c => {
    c.kindName = KINDS[c.kind];
    c.hkName = c.hk >= 0 ? HKINDS[c.hk] : "";
    c.sortName = c.name.replace(/^\s*([(（][^)）]*[)）]\s*)+/, "");  // '(의료법인)…' 같은 머리 괄호는 정렬에서 뺀다
    c.text = norm([c.name, c.addr, c.tel, c.tel.replace(/-/g, ""), c.htel, c.code, c.hk >= 0 ? "특진 청력" : ""].join("|"));
    if (c.lat == null) return;
    // 팝업은 열 때마다 만든다(출발지에 따라 거리·링크가 바뀐다)
    if (c.desig) c.marker = L.circleMarker([c.lat, c.lng], {
      radius: 7, weight: 1.5, color: "#fff", fillColor: css(`--k${c.kind}`), fillOpacity: .92
    }).bindPopup(() => popup(c)).bindTooltip(c.name);
    if (c.hk >= 0) c.hmarker = L.circleMarker([c.lat, c.lng], {
      radius: 9, weight: 2.5, color: "#fff", dashArray: c.desig ? null : "3 2",
      fillColor: css(`--h${c.hk}`), fillOpacity: .95
    }).bindPopup(() => popup(c)).bindTooltip("청력 특진 · " + c.name);
  });
  // 공단 소속기관 — 같은 건물에 있는 기관(예: 지역본부+특고센터)은 표식 하나로 묶는다
  offices = d.offices || [];
  offices.forEach(o => {
    const [s0, s1] = o.addr.split(" ");
    // '전남광주통합특별시'(2026.7. 통합) 주소는 구 이름으로 광주·전남을 가른다(시도 선택은 원자료 표기 기준)
    o.sido = s0 === "전남광주통합특별시" ? (/^(동구|서구|남구|북구|광산구)$/.test(s1) ? "광주" : "전남") : (SIDO_SHORT[s0] || s0);
    let st = sites.find(x => x.lat === o.lat && x.lng === o.lng);
    if (!st) sites.push(st = {lat: o.lat, lng: o.lng, items: []});
    st.items.push(o); o.site = st;
  });
  sites.forEach(st => {
    st.marker = L.marker([st.lat, st.lng], {
      icon: L.divIcon({className: "", html: `<div class="ofc-ic${st.items.length > 1 ? " multi" : ""}">${OLETTER[st.items[0].kind]}</div>`,
                       iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10]}),
      alt: "공단 " + st.items.map(o => o.short).join(" · "), zIndexOffset: 1000
    }).bindPopup(() => ofcPopup(st)).bindTooltip("공단 " + st.items.map(o => o.short).join(" · "));
  });

  $("foot").innerHTML =
    `개인이 공공데이터로 만든 비공식 참고용 지도(근로복지공단 공식 서비스 아님) · ` +
    `「근로복지공단 산재보험 지정의료기관 현황정보」(${esc(META.asof)} 기준, <a href="https://www.data.go.kr/data/3044320/fileData.do" target="_blank" rel="noopener">공공데이터포털</a>), ` +
    `거리는 출발지에서의 직선거리입니다 · 배경지도 © 국토교통부 브이월드 · ` +
    `<a href="${REPORT}" target="_blank" rel="noopener">오류 제보</a>`;
  buildFilters();
  allBounds = L.latLngBounds(H.filter(c => c.lat != null).map(c => [c.lat, c.lng])).pad(.03);
  // 주소로 상태 열기: ?sido=서울(시도별 목록 페이지의 「지도에서 보기」) · &sgg=강남구 · &q=검색어 · ?id=기관 기호
  const P = new URLSearchParams(location.search);
  const has = (sel, v) => v && [...sel.options].some(o => o.value === v);
  if (has(sidoSel, P.get("sido"))) {
    sidoSel.value = P.get("sido"); fillSgg();
    if (has(sggSel, P.get("sgg"))) sggSel.value = P.get("sgg");
  }
  if (P.get("q")) $("q").value = P.get("q");
  const target = P.get("id") && H.find(c => c.code === P.get("id"));
  if (target && target.lat == null) $("q").value = target.code;  // 위치 미확인 기관은 목록으로 보여 준다
  else if (target) pendingFocus = target;
  // ?id= 로 열 때는 전국 맞춤을 하지 않는다 — 맞춤 애니메이션이 끝나며 기관으로 옮긴 화면을 되돌린다
  if ((sidoSel.value || $("q").value) && !pendingFocus) apply();
  else { apply(false); if (!pendingFocus) map.fitBounds(allBounds); }
  if (target) history.replaceState(null, "", `?id=${encodeURIComponent(target.code)}`);  // apply 가 지운 id 를 되살린다
}

// ── 필터 ───────────────────────────────────────────
const sidoSel = $("sido"), sggSel = $("sgg"), kindBox = $("kinds"), hKindBox = $("hKinds");
const hearOn = $("hearOn"), hearOnly = $("hearOnly"), ofcOn = $("ofcOn"), ofcKinds = $("ofcKinds");
function buildFilters(){
  const bySido = {};
  H.forEach(c => { (bySido[c.sido || "기타"] ||= []).push(c); });
  [...SIDO_ORDER, ...Object.keys(bySido).filter(s => !SIDO_ORDER.includes(s))].filter(s => bySido[s]).forEach(s =>
    sidoSel.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)} (${bySido[s].length})</option>`));
  KINDS.forEach((k, i) => {
    const n = H.filter(c => c.desig && c.kind === i).length;
    if (n) kindBox.insertAdjacentHTML("beforeend",
      `<label><input type="checkbox" data-kind="${i}" checked><span class="dot" style="background:var(--k${i})"></span>${esc(k)} ${n.toLocaleString()}</label>`);
  });
  HKINDS.forEach((k, i) => {
    const n = H.filter(c => c.hk === i).length;
    if (n) hKindBox.insertAdjacentHTML("beforeend",
      `<label><input type="checkbox" data-hk="${i}" checked><span class="dot lg" style="background:var(--h${i})"></span>${esc(HSHORT[k] || k)} ${n}</label>`);
  });
  $("hearN").textContent = `${H.filter(c => c.hk >= 0).length}곳`;
  $("ofcN").textContent = `${offices.length}곳`;
  OKINDS.forEach(({k, m}) => {
    const n = offices.filter(o => m.includes(o.kind)).length;
    ofcKinds.insertAdjacentHTML("beforeend", `<label><input type="checkbox" data-okind="${esc(k)}" checked>${esc(k)} ${n}</label>`);
  });
}
function fillSgg(){
  const s = sidoSel.value;
  sggSel.innerHTML = `<option value="">시·군·구 전체</option>`;
  sggSel.disabled = !s;
  if (!s) return;
  const cnt = {};
  H.filter(c => (c.sido || "기타") === s).forEach(c => { cnt[c.sgg || "(미상)"] = (cnt[c.sgg || "(미상)"] || 0) + 1; });
  Object.keys(cnt).sort((a, b) => a.localeCompare(b, "ko")).forEach(g =>
    sggSel.insertAdjacentHTML("beforeend", `<option value="${esc(g)}">${esc(g)} (${cnt[g]})</option>`));
}

const popup = c => `<div class="pop">${popBody(c)}</div>`;
// 같은 좌표(같은 건물)의 기관들 — 표식 하나에 모아 차례로 보인다
const grpPopup = cs => `<div class="pop"><div class="grp-head">● 같은 위치 ${cs.length}곳</div>` +
  cs.map(c => `<div class="grp-item" data-code="${esc(c.code)}">${popBody(c)}</div>`).join("") + `</div>`;
function popBody(c){
  const d = kmFrom(c);
  const hearHead = c.hk >= 0
    ? `<div class="hear-note">◎ 소음성 난청 청력검사 특별진찰 의뢰기관 · ${esc(c.hkName)} · <a href="${HEARING_MAP}" target="_blank" rel="noopener">특진 지도</a></div>` : "";
  return `<h3>${esc(c.name)}</h3>${hearHead}
  <table>
   <tr><td>산재 지정</td><td>${c.desig ? `지정의료기관 · ${esc(c.kindName)} <span style="color:#8a8f99">(이름 기준 추정)</span>`
                                          : `<span style="color:#8a8f99">지정의료기관 목록(${esc(META.asof)})에는 없음</span>`}</td></tr>
   <tr><td>주소</td><td>${c.zip ? `(${esc(c.zip)}) ` : ""}${esc(c.addr)}</td></tr>
   <tr><td>전화</td><td>${c.tel ? esc(c.tel) : "자료 없음"}</td></tr>
   ${c.htel ? `<tr><td>특진 연락처</td><td><a href="${esc(telHref(c.htel))}">${esc(c.htel)}</a></td></tr>` : ""}
   ${c.code ? `<tr><td>기호</td><td>${esc(c.code)}</td></tr>` : ""}
   ${d != null ? `<tr><td>거리</td><td>출발지에서 직선 ${fmtKm(d)}</td></tr>` : ""}
  </table>${goLinks(c)}${subLinks(c)}`;
}
// 같은 좌표 기관 묶음 표식. 표식이 겹치면 맨 위 하나만 눌려서(2026-10-22 확인: 329곳, 360개 가려짐) 하나로 합친다.
// 특진으로 보이는 기관이 끼어 있으면 특진 묶음(hcluster)에 넣고 금색 테두리로 표시한다. 같은 구성은 표식을 다시 쓴다.
const grpCache = new Map();
function groupMarker(cs){
  cs.sort((a, b) => a.code.localeCompare(b.code));
  const key = cs.map(c => c.code + (c.asHear ? "h" : "")).join(",");
  let m = grpCache.get(key);
  if (!m) {
    const h = cs.find(c => c.asHear);
    m = L.marker([cs[0].lat, cs[0].lng], {
      n: cs.length, alt: cs.map(c => c.name).join(" · "),
      icon: L.divIcon({className: "", iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11],
        html: `<div class="grp-ic${h ? " hear" : ""}" style="background:var(${h ? `--h${h.hk}` : `--k${cs[0].kind}`})">${cs.length}</div>`})
    }).bindPopup(() => grpPopup(cs), {maxHeight: mobile.matches ? 220 : 360})  // 휴대폰은 지도 높이가 낮다.bindTooltip(`같은 위치 ${cs.length}곳 · ` + cs.map(c => c.name).join(" · "));
    m.isHear = !!h;
    grpCache.set(key, m);
  }
  cs.forEach(c => c.gmarker = m);
  return m;
}
function ofcPopup(st){
  const d = kmFrom(st);
  return `<div class="pop"><div class="ofc-head">■ 근로복지공단 소속기관 · 의료기관이 아닙니다</div>` +
    st.items.map(o => `<div class="ofc-item"><h3>${esc(o.name)}</h3><table>
     <tr><td>종류</td><td>${esc(o.kind)}</td></tr>
     <tr><td>주소</td><td>${esc(o.addr)}</td></tr>
     ${o.area ? `<tr><td>담당</td><td>${esc(o.area)}</td></tr>` : ""}
     <tr><td>전화</td><td><a href="tel:15880075">1588-0075</a> (대표) · <a href="${esc(o.url)}" target="_blank" rel="noopener">부서별 연락처</a></td></tr>
    </table></div>`).join("") +
    `${d != null ? `<table><tr><td>거리</td><td>출발지에서 직선 ${fmtKm(d)}</td></tr></table>` : ""}<div class="go">${routeLinks({name: st.items[0].name, lat: st.lat, lng: st.lng})}</div></div>`;
}

// ── 목록·지도 갱신 ──────────────────────────────────
const list = $("list");
let hits = [], ohit = [], shown = 0;
function focus(c){
  if (mobile.matches) { backY = scrollY; $("map").scrollIntoView({block: "start"}); setJump(); }
  if (c.site) {  // 소속기관: 묶음이 없어 바로 연다
    map.setView([c.lat, c.lng], Math.max(map.getZoom(), 15), {animate: false});
    return c.site.marker.openPopup();
  }
  const m = c.gmarker || (c.asHear ? c.hmarker : c.marker);
  if (!m) return;
  ((c.gmarker ? m.isHear : c.asHear) ? hcluster : cluster).zoomToShowLayer(m, () => {
    map.setView([c.lat, c.lng], Math.max(map.getZoom(), 16), {animate: false});
    m.openPopup();
    // 묶음 팝업이면 고른 기관을 표시하고 그 자리로 내린다
    const box = c.gmarker && m.getPopup().getElement()?.querySelector(".leaflet-popup-content");
    const it = box?.querySelector(`.grp-item[data-code="${CSS.escape(c.code)}"]`);
    if (it) { it.classList.add("on"); box.scrollTop += it.getBoundingClientRect().top - box.getBoundingClientRect().top - 4; }
    // 팝업 윗부분이 지도 밖으로 나가면 내려 준다(묶음 확대 직후에는 Leaflet 자동 이동이 안 될 때가 있다)
    const pe = m.getPopup().getElement();
    const over = pe ? pe.getBoundingClientRect().top - $("map").getBoundingClientRect().top - 10 : 0;
    if (over < 0) map.panBy([0, over], {animate: false});
  });
}
function row(c){
  const li = document.createElement("li");
  li.tabIndex = 0;
  li.className = (c.asHear ? "hear" : "") + (c.lat == null ? " nogeo" : "");
  const mark = c.asHear ? `<span class="dot lg" style="background:var(--h${c.hk})"></span>`
                        : `<span class="dot" style="background:var(--k${c.kind})"></span>`;
  li.innerHTML = `<div class="nm">${mark}${esc(c.name)}` +
    (c.hk >= 0 ? `<span class="tag h">청력 특진 · ${esc(HSHORT[c.hkName] || c.hkName)}</span>` : "") +
    (c.desig ? `<span class="tag">${esc(c.kindName)}</span>` : `<span class="tag">산재 지정 목록 외</span>`) +
    `${c.lat == null ? `<span class="tag w">위치 미확인</span>` : ""}${c.km != null ? `<span class="km">${fmtKm(c.km)}</span>` : ""}</div>
    <div class="ad">${esc(c.addr)}</div>${goLinks(c)}`;
  li.onclick = e => { if (!e.target.closest("a")) focus(c); };
  li.onkeydown = e => { if (e.key === "Enter" && e.target === li) focus(c); };
  return li;
}
function ofcRow(o){
  const li = document.createElement("li");
  li.className = "ofc"; li.tabIndex = 0;
  li.innerHTML = `<div class="nm"><span class="sq"></span>${esc(o.short)} <span class="tag o">${esc(OLABEL[o.kind])}</span>${o.km != null ? `<span class="km">${fmtKm(o.km)}</span>` : ""}</div>
    <div class="ad">${esc(o.addr)}</div>${o.area ? `<div class="ad">담당: ${esc(o.area)}</div>` : ""}<div class="go">${routeLinks(o)}</div>`;
  li.onclick = e => { if (!e.target.closest("a")) focus(o); };
  li.onkeydown = e => { if (e.key === "Enter" && e.target === li) focus(o); };
  return li;
}
function renderMore(){
  list.querySelectorAll("li.more, li.sec, li.ofc").forEach(li => li.remove());
  const frag = document.createDocumentFragment();
  hits.slice(shown, shown + LIST_STEP).forEach(c => frag.appendChild(row(c)));
  shown = Math.min(hits.length, shown + LIST_STEP);
  if (ohit.length) {
    // 소속기관은 의료기관 뒤에 별도 구역으로(섞지 않는다). 「더 보기」 전이라도 보이게 그린 목록 바로 아래에 둔다.
    const h = document.createElement("li");
    h.className = "sec";
    h.textContent = `■ 공단 소속기관 ${ohit.length}곳 — 의료기관이 아닙니다`;
    frag.appendChild(h);
    ohit.forEach(o => frag.appendChild(ofcRow(o)));
  }
  if (shown < hits.length) {
    const li = document.createElement("li");
    li.className = "more"; li.tabIndex = 0;
    li.textContent = `의료기관 목록 ${shown.toLocaleString()} / ${hits.length.toLocaleString()}곳 — 눌러서 ${Math.min(LIST_STEP, hits.length - shown)}곳 더 보기`;
    li.onclick = renderMore;
    li.onkeydown = e => { if (e.key === "Enter") renderMore(); };
    frag.appendChild(li);
  }
  list.appendChild(frag);
}
function apply(fit = true){
  const q = $("q").value.trim().split(/\s+/).map(norm).filter(Boolean);
  const sido = sidoSel.value, sgg = sggSel.value;
  const kinds = new Set([...kindBox.querySelectorAll("input:checked")].map(i => +i.dataset.kind));
  const hk = new Set([...hKindBox.querySelectorAll("input:checked")].map(i => +i.dataset.hk));
  hits = H.filter(c => {
    if ((sido && (c.sido || "기타") !== sido) || (sgg && (c.sgg || "(미상)") !== sgg) || !q.every(w => c.text.includes(w))) return false;
    // 특진 기관은 특진 표시가 켜져 있으면 특진 색 큰 동그라미로, 꺼져 있으면 일반 지정의료기관 동그라미로 보인다
    c.asHear = c.hk >= 0 && hearOn.checked && hk.has(c.hk);
    return c.asHear || (!hearOnly.checked && c.desig && kinds.has(c.kind));
  });
  const okinds = new Set(OKINDS.filter(x => ofcKinds.querySelector(`[data-okind="${x.k}"]`).checked).flatMap(x => x.m));
  // 소속기관은 꺼져 있어도 검색어가 있으면 찾아 보여 준다
  ohit = !ofcOn.checked && !q.length ? [] : offices.filter(o => okinds.has(o.kind) && (!sido || o.sido === sido) &&
    (!sgg || o.addr.includes(sgg)) && q.every(w => norm([o.name, o.addr, o.area].join("|")).includes(w)));
  [...hits, ...ohit].forEach(c => c.km = kmFrom(c));
  const order = sortBy === "dist" && origin
    ? (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)
    : (a, b) => (a.sortName || a.short).localeCompare(b.sortName || b.short, "ko");
  hits.sort(order); ohit.sort(order);
  cluster.clearLayers(); hcluster.clearLayers(); ofcLayer.clearLayers();
  const at = new Map(), mk = [], hmk = [];
  hits.forEach(c => {
    c.gmarker = null;
    if (c.asHear ? c.hmarker : c.marker) { const k = c.lat + "," + c.lng; at.has(k) ? at.get(k).push(c) : at.set(k, [c]); }
  });
  at.forEach(cs => {
    if (cs.length === 1) return (cs[0].asHear ? hmk : mk).push(cs[0].asHear ? cs[0].hmarker : cs[0].marker);
    const g = groupMarker(cs);
    (g.isHear ? hmk : mk).push(g);
  });
  cluster.addLayers(mk);
  hcluster.addLayers(hmk);
  new Set(ohit.map(o => o.site)).forEach(st => ofcLayer.addLayer(st.marker));
  list.innerHTML = ""; shown = 0;
  renderMore();
  const nh = hits.filter(c => c.asHear).length;
  $("hearState").textContent = !hearOn.checked ? "· 숨김" : hearOnly.checked ? "· 특진만 보기" : "· 표시 중";
  $("count").innerHTML = `표시 ${hits.length.toLocaleString()}곳` + (nh ? `(특진 ${nh})` : "") + ` / 전체 ${H.length.toLocaleString()}곳` +
    (ohit.length ? ` · 소속기관 ${ohit.length}곳` : "") + ` <span class="asof">· 지정 자료 ${esc(META.asof)} 기준</span>`;
  syncUrl();
  const geo = [...hits.filter(c => c.lat != null), ...ohit];
  if (!fit || !geo.length) return;
  if (sortBy === "dist" && origin) {  // 출발지와 가까운 5곳이 한 화면에
    map.fitBounds(L.latLngBounds([[origin.lat, origin.lng], ...geo.slice(0, 5).map(c => [c.lat, c.lng])]).pad(.2), {maxZoom: 15});
  } else if (q.length || sido || hearOnly.checked) {
    map.fitBounds(L.latLngBounds(geo.map(c => [c.lat, c.lng])).pad(.1), {maxZoom: 16});
  }
}
// 검색어·시도·시군구를 주소에 담는다(그대로 복사해 보내면 같은 화면이 열린다). 기록은 쌓지 않는다.
function syncUrl(){
  const p = new URLSearchParams();
  if ($("q").value.trim()) p.set("q", $("q").value.trim());
  if (sidoSel.value) p.set("sido", sidoSel.value);
  if (sggSel.value) p.set("sgg", sggSel.value);
  const s = p.toString();
  history.replaceState(null, "", (s ? "?" + s : location.pathname) + location.hash);
}
// 필터 초기화 — 출발지는 필터가 아니라 그대로 둔다
$("reset").onclick = () => {
  $("q").value = ""; sidoSel.value = ""; fillSgg();
  document.querySelectorAll("#kinds input, #hKinds input, #ofcKinds input").forEach(i => i.checked = true);
  hearOn.checked = true; hearOnly.checked = false; ofcOn.checked = false; ofcKinds.hidden = true;
  apply(false);
  if (allBounds) map.fitBounds(allBounds);
};
let qTimer;
$("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(apply, 200); });
sidoSel.addEventListener("change", () => { fillSgg(); apply(); });
sggSel.addEventListener("change", () => apply());
kindBox.addEventListener("change", () => apply(false));
hKindBox.addEventListener("change", () => apply(false));
hearOn.addEventListener("change", () => { if (!hearOn.checked) hearOnly.checked = false; apply(false); });
hearOnly.addEventListener("change", () => { if (hearOnly.checked) hearOn.checked = true; apply(); });
ofcOn.addEventListener("change", () => { ofcKinds.hidden = !ofcOn.checked; apply(false); });
ofcKinds.addEventListener("change", () => apply(false));

// ── 정렬 ───────────────────────────────────────────
const sortBtns = [...document.querySelectorAll(".sort button")];
function setSort(s, fit = true){
  sortBy = s;
  sortBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === s)));
  apply(fit);
}
sortBtns.forEach(b => b.onclick = () => setSort(b.dataset.sort));

// ── 출발지 ─────────────────────────────────────────
const orgNow = $("orgNow"), orgQ = $("orgQ");
const ORG_HINT = orgNow.innerHTML;
let orgMarker = null;
function setOrigin(o){
  origin = o;
  if (orgMarker) { map.removeLayer(orgMarker); orgMarker = null; }
  const distBtn = sortBtns.find(b => b.dataset.sort === "dist");
  distBtn.disabled = !o;
  distBtn.title = o ? "출발지에서 가까운 순" : "출발지를 먼저 정하세요";
  if (!o) { orgNow.innerHTML = ORG_HINT; setSort("name", false); return; }
  orgMarker = L.circleMarker([o.lat, o.lng], {radius: 9, weight: 4, color: css("--gold"), fillColor: "#1b2a4a", fillOpacity: 1})
    .bindTooltip(`출발지: ${o.name}`).addTo(map);
  orgMsg("");
  setSort("dist");
}
// 안내문(검색 중·실패)을 보여 주되, 이미 정한 출발지는 그 아래에 계속 보인다
function orgMsg(t){
  const o = origin;
  orgNow.innerHTML = (t ? `<span>${esc(t)}</span>` : "") + (o
    ? `<span>출발지 <b>${esc(o.name)}</b>${o.addr && o.addr !== o.name ? ` · ${esc(o.addr)}` : ""}</span><button type="button" id="orgClear">지우기</button>`
    : (t ? "" : ORG_HINT));
  orgNow.style.flexWrap = t && o ? "wrap" : "";
  const clr = $("orgClear");
  if (clr) clr.onclick = () => { orgQ.value = ""; setOrigin(null); };
}
// 브이월드 검색 API(JSONP). 도로명 → 지번 → 장소(건물·기관명) 순으로 찾고, 첫 결과를 쓴다.
function vwSearch(query, type, category){
  return new Promise((resolve, reject) => {
    const cb = "vw" + Date.now() + Math.floor(Math.random() * 1e6);
    const s = document.createElement("script");
    const done = v => { delete window[cb]; s.remove(); clearTimeout(t); v instanceof Error ? reject(v) : resolve(v); };
    const t = setTimeout(() => done(new Error("응답 없음")), 8000);
    window[cb] = r => done(r?.response?.status === "OK" ? r.response.result.items : []);
    const p = new URLSearchParams({service: "search", request: "search", version: "2.0", size: "5", query, type,
      format: "json", errorformat: "json", key: VWORLD_KEY, callback: cb});
    if (category) p.set("category", category);
    s.src = "https://api.vworld.kr/req/search?" + p;
    s.onerror = () => done(new Error("연결 실패"));
    document.head.appendChild(s);
  });
}
// 공단 소속기관 이름(예: '광산지사', '근로복지공단 서울강남지사')이면 브이월드에 묻지 않고 바로 쓴다
function findOffice(q){
  const k = q.replace(/\s+/g, "").replace(/^(근로복지)?공단/, "");
  if (!k) return null;
  const o = offices.find(o => o.short === k || o.name.replace(/\s+/g, "") === q.replace(/\s+/g, "")) ||
            (/(지사|본부|센터|위원회)$/.test(k) && offices.find(o => o.short.startsWith(k)));
  return o ? {name: o.short, addr: o.addr, lat: o.lat, lng: o.lng} : null;
}
async function findPlace(q){
  const ofc = findOffice(q);
  if (ofc) return ofc;
  const tries = [];
  if (/(로|길)\s*\d/.test(q)) tries.push(["address", "road"]);
  tries.push(["address", "parcel"], ["place"]);
  for (const [type, cat] of tries) {
    const items = await vwSearch(q, type, cat);
    if (items.length) {
      const it = items[0], ad = it.address || {};
      return {name: type === "place" ? it.title : q, addr: ad.road || ad.parcel || "", lat: +it.point.y, lng: +it.point.x};
    }
  }
  return null;
}
$("orgForm").addEventListener("submit", async e => {
  e.preventDefault();
  const q = orgQ.value.trim();
  if (!q) return;
  orgMsg("찾는 중…");
  try {
    const o = await findPlace(q);
    if (o) setOrigin(o);
    else orgMsg(`'${q}'을(를) 찾지 못했습니다. 시·군·구를 붙이거나 도로명 주소로 다시 입력해 보세요.`);
  } catch (err) {
    orgMsg(`주소 검색에 실패했습니다(${err.message}). 지도를 우클릭해 출발지를 정할 수 있습니다.`);
  }
});
$("gps").onclick = () => {
  if (!navigator.geolocation) return orgMsg("이 브라우저는 위치 확인을 지원하지 않습니다.");
  orgMsg("현재 위치 확인 중…");
  navigator.geolocation.getCurrentPosition(
    p => setOrigin({name: "내 위치", lat: p.coords.latitude, lng: p.coords.longitude}),
    err => orgMsg(err.code === 1 ? "위치 권한이 거부되었습니다. 주소를 입력하거나 지도를 우클릭하세요."
                                 : "현재 위치를 확인하지 못했습니다. 주소를 입력하거나 지도를 우클릭하세요."),
    {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
};
map.on("contextmenu", e => {
  orgQ.value = "";
  setOrigin({name: "지도에서 지정한 곳", lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6)});
});
