# Session Summary
최종 갱신: 2026-11-19 (노트북)

## 1. 프로젝트 목적
**산재맵** — 근로복지공단 산재보험 지정의료기관(공공데이터포털 CSV, 6,742곳, 2025-12-31 기준)·소음성 난청 청력 특진 의뢰기관 220곳·공단 소속기관 78곳을
브이월드 지도에서 찾는 무료 정적 웹페이지. GitHub Pages 공개 https://himnuszkorea.github.io/sanjaemap/ (public `himnuszkorea/sanjaemap`).

## 2. 현재 상태
11-18 휴대폰 첫 화면 개편(목적 버튼·지도/목록 탭·「산재 처음이세요?」) + 재활인증 202곳 표시 + **산재 지정약국 25,203곳** 게시 완료 — 현재 판 **20261118e**(c045c1b).
휴대폰에서 약국 토글이 보이는 것은 사용자가 실제 휴대폰으로 확인(11-18). 작업 트리 깨끗, 미커밋 없음.
남은 것은 쿠키 없는 방문 통계(사용자가 서비스 선택·가입)와 검색 노출 관찰.

## 3. 완료된 작업
- [10-18~22] 구축(`build_data.py` 지오코딩·검색·필터·거리순·길찾기) · 검색 등록 · 하단 `#about`(FAQ·시도 페이지 17 `r/<slug>/`) · 루트 안내 화면 A안 · 같은 좌표 묶음 `groupMarker()` · 위치 미확인 12→2(`OVERRIDE`) · `norm()` 검색 · `?q/sido/sgg/id` 공유 · 오류 제보 = GitHub 이슈
- [10-27] 검색어 확장(산재지도·산재병원·산재의료기관 — 제목·부제·설명·FAQ에 1~3회, JSON-LD `alternateName`) · 구글 색인 3주소 「등록됨」 · 네이버 수집 요청 3건
- [11-18] **휴대폰 첫 화면 개편**(b221e2c): `#quick` 목적 버튼 hosp·hear·ofc(`presetFilters()`·`locate()` GPS) · 세부 필터 `details#more`(휴대폰 접힘) · 지도/목록 탭 `#tabs`(`:root[data-tab]`, 지도 탭 한 손가락, 숨은 지도 fitBounds 는 `fitTo()` 가 미룸) · `dialog#first` 3단계 — 산재보험법(시행 2026.7.1.) 제36·38·40·41·52·112조 원문 조회
- [11-18] **재활인증**(21bcfbb): API 15058644 `getSjBoheomJhCftHptPstateList` 203곳 중 202곳 기호 일치(라이프재활의학과병원은 지정 목록에 없음) → 팝업 행·목록 태그·`#rehabOnly`
- [11-18] **지정약국**(6e2ee33): `getSjJijeongyakgukChakgiList` 25,203곳 · 좌표 24,498(실패 705곳 2.8%는 「위치 미확인」, 두 번 재시도해도 못 읽는 주소) · 토글 `#pharmOn` 켤 때만 `data/pharm.json`(3.3MB) 지연 로드 · 별도 묶음 `phLayer`(◆) · 목록 50곳까지
- [11-18] 전화번호 하이픈(d4cc3c3, `build_extra.py` `fmt_tel`) — 걸 수 없는 값(0 채움·자리 모자람) 437건은 빈칸(「자료 없음」) · 내선 표시(`-2`) 2건은 원문
- [11-18] 토글 위치(c045c1b): 휴대폰 지도 탭은 `aside` 전체를 숨겨 약국 토글이 안 보였다 → `.ext-row` 를 `#quick`(두 탭 공통)으로 옮김

## 4. 미완료 작업
- **쿠키 없는 방문 통계(11-18 제안 5)** — 진행: 없음 / 남은 것: 사용자가 서비스 고르고 가입(예: GoatCounter·Cloudflare Web Analytics) → `index.html` 에 스크립트 한 줄 + `#about` 에 「쿠키 없는 방문 집계」 한 줄
- 실제 휴대폰 세부 확인 — 진행: 약국 토글 표시 확인(사용자) / 남은 것: 목적 버튼 → GPS 권한 창 → 거리순 · 「링크 공유」 (창 높이·약국 팝업 폭·`?id=` 팝업은 11-19 브라우저 점검 375px·1280px 통과 — 실기기 GPS 만 남음)
- 검색 노출 관찰 — 진행: 구글·네이버 요청 완료(10-27) / 남은 것: `sitemap.xml?v=1` 상태 재확인 · 색인·순위 관찰
- (선택) 약국 좌표 실패 705곳 — 주소에 건물명·층이 붙은 경우가 많다. 괄호·층 떼고 재지오코딩하면 일부 살아날 수 있음
- (선택) 위치 미확인 지정기관 2곳(파주 교하하나의원·교하제일의원) · 이름만 맞춘 2곳(광명 윤정형외과·대전 드림치과) 전화 확인

## 5. 주요 파일
- `index.html` — 메타·`#quick`(목적 버튼·출발지·`.ext-row` 재활인증/약국 토글)·`#tabs`·`aside#side` 필터·`dialog#first`·`#about`, `?v=` 판 번호 3곳
- `app.js` — `VER` · `init(d, rh)`(재활인증 표시) · `apply()`(필터·묶음·약국 `phit`·목록·`syncUrl`) · `phMarker/phPopup/phRow` · `pharmOn` change(지연 로드) · `setPurpose/presetFilters/locate` · `setTab/fitTo/placeQuick`
- `style.css` — 색 토큰(`--ph`·`--rh` 포함, 다크 대응), 휴대폰 `@media (max-width:760px)` 의 `:root[data-tab]` 규칙
- `tools/check.py` — 게시 전 정적 검사 · `tools/browser-check.js` — playwright 로 돌리는 화면 점검(11-19)
- `tools/build_data.py` — CSV → `data/hospitals.json` · `tools/build_pages.py` — 시도 페이지 17 + `sitemap.xml`
- `tools/build_extra.py` — API → `data/rehab.json`·`data/pharm.json`(+ `raw/api_*_<날짜>.json`), `fmt_tel`, `--no-geocode` 는 캐시만 · 키 `.env.local` `DATA_GO_KR_KEY`
- `tools/geocode_cache.json` — 지오코딩 캐시(약국 포함, 커밋함)
- `C:\claudecode\himnuszkorea.github.io\index.html` — 루트 안내 화면·네이버/구글 확인 태그

## 6. 핵심 판단 및 결정사항
- 호스팅 GitHub Pages / 탈락: Vercel 하위경로 · 네이버는 루트 저장소 경유(하위 경로 코드 101 거부)
- 루트는 넘기지 않는 안내 화면(A안, 10-21) / 이유: 넘김이면 구글 사이트 이름이 「GitHub Pages documentation」 / 탈락: 넘김 유지·루트 삭제(네이버 소유확인 풀림)
- 약국·재활인증은 **빌드 때 받아 정적 JSON**(11-18 제안 4) / 이유: 화면에 API 키가 나가지 않게 · 약국은 커서 토글 켤 때만 로드
- 포털 계정 일반 키(앞 90dd)를 쓴다 / 이유: MCP `SANJAE_SERVICE_KEY`(앞 bed9)로는 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`
- 재활인증·약국 토글은 `#quick` 에 둔다(11-18) / 이유: 휴대폰 지도 탭이 `aside` 를 숨김 / 탈락: 지도 탭에서 aside 일부만 보이기(지도 높이가 더 줄고 CSS 복잡)
- 걸 수 없는 전화번호는 빈칸 / 이유: 틀린 번호를 보여 주지 않는다
- 휴대폰 지도는 탭 도입으로 한 손가락 / 탈락: 두 손가락 방식(탭 이전)
- 겹침은 같은 좌표 표식 합치기 / 탈락: `disableClusteringAtZoom` 제거 · `?id=` 진입 땐 전국 fitBounds 생략
- 기관별 제보 링크 없음(10-22 사용자) · 검색어는 보이는 글에 1~3회(숨긴 키워드·전용 페이지·도메인 변경 탈락)

## 7. 해결되지 않은 문제
- 증상: 구글 서치콘솔 `…/sanjaemap/` 속성 사이트맵 「가져올 수 없음」 / 재현: 10-18·10-21·10-27(`?v=1`) 제출 모두 / 확인: 게시본 200·`application/xml`·파싱 정상 / 페이지는 URL 검사 요청으로 색인돼 실해는 작다
- 브이월드 지오코더가 대량 요청 중 `Remote end closed connection without response` 를 낸다 — 재실행하면 일부만 살아남(760 중 55). 남은 705곳은 주소 형식 문제로 보임

## 8. 다음 작업 순서
1. 사용자가 방문 통계 서비스를 정하면 `index.html` `</body>` 앞에 스크립트 한 줄 넣고 `#about` 안내 한 줄 추가 → 판 올려(`?v=` 3곳 + `app.js` `VER`) 게시
2. 실제 휴대폰에서 목적 버튼 → GPS → 거리순, 「산재 처음이세요?」 창 높이, 약국 팝업 오른쪽 넘침 확인 — 넘치면 `style.css` 에 휴대폰 팝업 `max-width` 조정
3. 구글 서치콘솔 「Sitemaps」·「페이지」·「실적」에서 「산재맵」·「산재지도」·「산재병원」 노출 관찰 — 하루 결과로 되돌리지 말 것
4. (선택) `tools/build_extra.py` 에 주소 괄호·층 떼는 2차 지오코딩을 넣어 약국 705곳 재시도
5. 2027-06-30 이후 새 CSV 갱신 + `build_extra.py` 재실행(약국·재활인증) — 숫자(6,742·220·78·25,203·203)는 `#about`·설명·루트에서 손으로 고친다

## 9. 주의사항
- **주소 `himnuszkorea.github.io/sanjaemap` 와 시도 slug 를 바꾸지 말 것**(공모전 A02·A03 원고) · 하단 비공식 문구(`app.js` `$("foot")`) 삭제 금지
- 확인 태그 삭제 금지: 산재맵 `google-site-verification`, 루트 `naver-site-verification`·`google-site-verification` · 루트에 자동 넘김 다시 넣지 말 것
- 「산재 처음이세요?」 문구를 고칠 때는 조문 원문을 다시 조회(기억 인용 금지)
- 화면 파일을 고치면 `?v=`(3곳)와 `VER` 를 함께 올린다(Pages 10분 캐시)
- **푸시 전 `py -3 tools/check.py`(매번) · 화면을 고쳤으면 `tools/browser-check.js` 브라우저 점검(README 「게시 전 점검」)** — 11-19 신설
- **작업 전 `git pull`** — 노트북·사무실 PC 두 곳에서 푸시한다
- 공개 저장소 — 커밋 전 `.env.local`·키 미포함 확인(`DATA_GO_KR_KEY` 값으로 grep). `config.js` 브이월드 키만 의도된 공개
- 웹 확인·검색은 **Aside 먼저**(사용자 지시) — 내장 브라우저는 localhost 미리보기만(루트 `.claude/launch.json` `sanjaemap`, 8765)
- 원본 CSV 는 CP949 · 광주·전남은 「전남광주」 정제 주소 · 지오코더는 수백 건마다 502·연결 끊김(재시도)
- 네이버 「웹 페이지 수집」은 전체 주소로 · 서치콘솔 URL 검사는 개요 화면 검색 아이콘으로
- 사무실 PC 빌드엔 `.env.local`(브이월드 키 + `DATA_GO_KR_KEY`)과 특진 데이터 사본이 필요
