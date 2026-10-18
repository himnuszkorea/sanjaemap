// 산재보험 지정의료기관 검색지도 — data/hospitals.json(tools/build_data.py 생성)을 읽어 그린다.
// 출발지·거리·길찾기·브이월드 검색은 청력 특진 지도(gj-hearing-clinic-map/index.html)와 같은 방식이다.
"use strict";
const VWORLD_KEY = window.VWORLD_KEY || "";
const HEARING_MAP = "https://gj-hearing-clinic-map.vercel.app/";
const SIDO_ORDER = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const LIST_STEP = 200;  // 목록은 200곳씩 그린다(6천여 곳을 한 번에 그리면 느리다)

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const $ = id => document.getElementById(id);

// ── 지도 ───────────────────────────────────────────
const map = L.map("map", {minZoom: 6, maxZoom: 19, zoomSnap: 0.5, preferCanvas: true}).setView([36.3, 127.8], 7);
L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`, {
  minZoom: 6, maxZoom: 19, attribution: "© 국토교통부 브이월드"
}).addTo(map);
const cluster = L.markerClusterGroup({showCoverageOnHover: false, maxClusterRadius: 50, chunkedLoading: true,
                                      disableClusteringAtZoom: 17});
map.addLayer(cluster);

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
const goLinks = c =>
  `<div class="go">${c.tel ? `<a class="tel" href="${esc(telHref(c.tel))}">전화 ${esc(c.tel)}</a>` : ""}` +
  (c.lat != null ? `<a class="kakao" href="${esc(kakaoUrl(c))}" target="_blank" rel="noopener">카카오 길찾기</a>` +
  `<a class="naver" href="${esc(naverUrl(c))}" target="_blank" rel="noopener">네이버 길찾기</a>` : "") + `</div>`;

// ── 자료 읽기 ──────────────────────────────────────
let H = [], KINDS = [], META = {};
fetch("data/hospitals.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init)
  .catch(err => { $("sub").textContent = `자료를 불러오지 못했습니다(${err.message}).`; });

function init(d){
  META = d.meta; KINDS = d.meta.kinds;
  const F = d.meta.fields;
  H = d.rows.map(r => Object.fromEntries(F.map((f, i) => [f, r[i]])));
  H.forEach(c => {
    c.kindName = KINDS[c.kind];
    c.sortName = c.name.replace(/^\s*([(（][^)）]*[)）]\s*)+/, "");  // '(의료법인)…' 같은 머리 괄호는 정렬에서 뺀다
    c.text = [c.name, c.addr, c.tel, c.tel.replace(/-/g, ""), c.code].join(" ").toLowerCase();
    if (c.lat == null) return;
    c.marker = L.circleMarker([c.lat, c.lng], {
      radius: c.hearing ? 8 : 7, weight: c.hearing ? 3 : 1.5, color: c.hearing ? css("--hear") : "#fff",
      fillColor: css(`--k${c.kind}`), fillOpacity: .92
    }).bindPopup(() => popup(c)).bindTooltip(c.name);  // 팝업은 열 때마다 만든다(출발지에 따라 거리·링크가 바뀐다)
  });
  const located = H.filter(c => c.lat != null).length;
  $("sub").innerHTML = `전국 ${H.length.toLocaleString()}곳 · ${esc(META.asof.replace(/-/g, "."))}. 기준 · ` +
    `<b>지정·해지가 수시로 있으니 방문 전 전화로 확인하세요</b>`;
  $("foot").innerHTML =
    `자료: 근로복지공단 「${esc(META.title)}」(${esc(META.asof)} 기준, <a href="https://www.data.go.kr/data/3044320/fileData.do" target="_blank" rel="noopener">공공데이터포털</a>, 이용허락범위 제한 없음) · ` +
    `종류는 원자료에 없어 기관명으로 추정한 것입니다 · 위치는 주소를 좌표로 변환한 것으로 실제 출입구와 다를 수 있습니다(위치 확인 ${located.toLocaleString()}곳) · ` +
    `청력 특진 표시는 <a href="${HEARING_MAP}" target="_blank" rel="noopener">소음성 난청 특별진찰 의뢰 의료기관 지도</a>와 의료기관기호가 같은 곳 · ` +
    `거리는 출발지에서의 직선거리입니다 · 배경지도 © 국토교통부 브이월드`;
  buildFilters();
  apply(false);
  map.fitBounds(L.latLngBounds(H.filter(c => c.lat != null).map(c => [c.lat, c.lng])).pad(.03));
}

// ── 필터 ───────────────────────────────────────────
const sidoSel = $("sido"), sggSel = $("sgg"), kindBox = $("kinds"), hearOnly = $("hearOnly");
function buildFilters(){
  const bySido = {};
  H.forEach(c => { (bySido[c.sido || "기타"] ||= []).push(c); });
  [...SIDO_ORDER, ...Object.keys(bySido).filter(s => !SIDO_ORDER.includes(s))].filter(s => bySido[s]).forEach(s =>
    sidoSel.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)} (${bySido[s].length})</option>`));
  KINDS.forEach((k, i) => {
    const n = H.filter(c => c.kind === i).length;
    if (n) kindBox.insertAdjacentHTML("beforeend",
      `<label><input type="checkbox" data-kind="${i}" checked><span class="dot" style="background:var(--k${i})"></span>${esc(k)} ${n.toLocaleString()}</label>`);
  });
  kindBox.insertAdjacentHTML("beforeend", `<span class="kind-note">종류는 기관명으로 추정한 분류입니다.</span>`);
  $("hearN").textContent = `${H.filter(c => c.hearing).length}곳`;
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

function popup(c){
  const d = kmFrom(c);
  return `<div class="pop"><h3>${esc(c.name)}</h3>
  ${c.hearing ? `<div class="hear-note">◎ 소음성 난청 청력검사 특별진찰 의뢰기관 · <a href="${HEARING_MAP}" target="_blank" rel="noopener">특진 지도</a></div>` : ""}
  <table>
   <tr><td>종류</td><td>${esc(c.kindName)} <span style="color:#8a8f99">(이름 기준 추정)</span></td></tr>
   <tr><td>주소</td><td>${c.zip ? `(${esc(c.zip)}) ` : ""}${esc(c.addr)}</td></tr>
   <tr><td>전화</td><td>${c.tel ? esc(c.tel) : "자료 없음"}</td></tr>
   <tr><td>기호</td><td>${esc(c.code)}</td></tr>
   ${d != null ? `<tr><td>거리</td><td>출발지에서 직선 ${fmtKm(d)}</td></tr>` : ""}
  </table>${goLinks(c)}</div>`;
}

// ── 목록·지도 갱신 ──────────────────────────────────
const list = $("list");
let hits = [], shown = 0;
function focus(c){
  if (!c.marker) return;
  if (matchMedia("(max-width:760px)").matches) $("map").scrollIntoView({block: "start"});
  cluster.zoomToShowLayer(c.marker, () => {
    map.setView([c.lat, c.lng], Math.max(map.getZoom(), 16), {animate: false});
    c.marker.openPopup();
  });
}
function row(c){
  const li = document.createElement("li");
  li.tabIndex = 0;
  if (c.lat == null) li.className = "nogeo";
  li.innerHTML = `<div class="nm"><span class="dot" style="background:var(--k${c.kind})"></span>${esc(c.name)}` +
    `<span class="tag">${esc(c.kindName)}</span>${c.hearing ? `<span class="tag h">청력 특진</span>` : ""}` +
    `${c.lat == null ? `<span class="tag w">위치 미확인</span>` : ""}${c.km != null ? `<span class="km">${fmtKm(c.km)}</span>` : ""}</div>
    <div class="ad">${esc(c.addr)}</div>${goLinks(c)}`;
  li.onclick = e => { if (!e.target.closest("a")) focus(c); };
  li.onkeydown = e => { if (e.key === "Enter" && e.target === li) focus(c); };
  return li;
}
function renderMore(){
  list.querySelector("li.more")?.remove();
  const frag = document.createDocumentFragment();
  hits.slice(shown, shown + LIST_STEP).forEach(c => frag.appendChild(row(c)));
  shown = Math.min(hits.length, shown + LIST_STEP);
  if (shown < hits.length) {
    const li = document.createElement("li");
    li.className = "more"; li.tabIndex = 0;
    li.textContent = `목록 ${shown.toLocaleString()} / ${hits.length.toLocaleString()}곳 — 눌러서 ${Math.min(LIST_STEP, hits.length - shown)}곳 더 보기`;
    li.onclick = renderMore;
    li.onkeydown = e => { if (e.key === "Enter") renderMore(); };
    frag.appendChild(li);
  }
  list.appendChild(frag);
}
function apply(fit = true){
  const q = $("q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sido = sidoSel.value, sgg = sggSel.value;
  const kinds = new Set([...kindBox.querySelectorAll("input:checked")].map(i => +i.dataset.kind));
  hits = H.filter(c => kinds.has(c.kind) && (!hearOnly.checked || c.hearing) &&
    (!sido || (c.sido || "기타") === sido) && (!sgg || (c.sgg || "(미상)") === sgg) &&
    q.every(w => c.text.includes(w)));
  hits.forEach(c => c.km = kmFrom(c));
  hits.sort(sortBy === "dist" && origin
    ? (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)
    : (a, b) => a.sortName.localeCompare(b.sortName, "ko"));
  cluster.clearLayers();
  cluster.addLayers(hits.filter(c => c.marker).map(c => c.marker));
  list.innerHTML = ""; shown = 0;
  renderMore();
  list.scrollTop = 0;
  $("count").textContent = `표시 ${hits.length.toLocaleString()}곳 / 전체 ${H.length.toLocaleString()}곳`;
  const geo = hits.filter(c => c.lat != null);
  if (!fit || !geo.length) return;
  if (sortBy === "dist" && origin) {  // 출발지와 가까운 5곳이 한 화면에
    map.fitBounds(L.latLngBounds([[origin.lat, origin.lng], ...geo.slice(0, 5).map(c => [c.lat, c.lng])]).pad(.2), {maxZoom: 15});
  } else if (q.length || sido || hearOnly.checked) {
    map.fitBounds(L.latLngBounds(geo.map(c => [c.lat, c.lng])).pad(.1), {maxZoom: 16});
  }
}
let qTimer;
$("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(apply, 200); });
sidoSel.addEventListener("change", () => { fillSgg(); apply(); });
sggSel.addEventListener("change", () => apply());
kindBox.addEventListener("change", () => apply(false));
hearOnly.addEventListener("change", () => apply());

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
async function findPlace(q){
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
