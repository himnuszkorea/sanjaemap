# Session Summary
최종 갱신: 2026-10-21 22:50 (노트북)

## 1. 프로젝트 목적
**산재맵** — 근로복지공단 산재보험 지정의료기관(공공데이터포털 CSV, 6,742곳, 2025-12-31 기준)·소음성 난청 청력 특진 의뢰기관 220곳·공단 소속기관 78곳을
브이월드 지도에서 찾는 무료 정적 웹페이지. GitHub Pages 공개 https://himnuszkorea.github.io/sanjaemap/ (public `himnuszkorea/sanjaemap`).

## 2. 현재 상태
10-21 구글 「산재맵」 검색 1쪽 이탈(색인은 유지)에 대응해 검색 노출 개선 3건을 게시하고, 구글·네이버 계정 작업(색인·수집 요청, 루트 속성 추가)까지 끝냈다.
두 저장소 모두 미커밋 없음·푸시 완료. 이제 할 일은 **관찰**뿐이다(10-25 사이트맵 상태 재확인 → 1~3주 순위·사이트 이름 관찰).

## 3. 완료된 작업
- [10-18] 데이터·화면 구축: `tools/build_data.py`(브이월드 지오코딩, 좌표 6,730/6,742·위치 미확인 12) · 검색·시도/시군구·종류·거리순·길찾기 · 특진 220(특진만 92)·소속기관 78 표시
- [10-18] 검색 등록: 메타·OG·JSON-LD·sitemap · 구글 서치콘솔(속성 `…/sanjaemap/`) · 네이버(하위 경로 거부 → 루트 저장소 `himnuszkorea.github.io` 신설)
- [10-19] 비공식 안내 문구(사외 공모전 A02 오해 방지) — 10-20부터 하단 `$("foot")` 한 곳만
- [10-20] 휴대폰 두 손가락 지도·`#jump` 버튼(판 20261020a), 머리글 안내 2줄 삭제(20261020b), 루트 바로 넘김(0f36a05 — 10-21 A안으로 대체됨)
- [10-21] **검색 노출 개선**(사무실 PC 인계 메모 `claude-code/산재맵_검색개선_인계메모.md`, e95cb97 대로) — 커밋 e733e64·루트 7bf1524
  - `/sanjaemap/` 하단 접이식 `<details id="about">`(산재맵이란·FAQ 4·지역별 링크 17) · `app.js` `?sido=서울` 로 열면 그 시도 필터+확대 · 판 20261021a
  - `tools/build_pages.py` 신설 → `r/<slug>/index.html` 17개(시군구별 표) + `sitemap.xml` 18주소 · 검산 6,834 = 지정 6,742 + 특진만 92
  - 루트 첫 화면: 넘김 제거·canonical 자기 자신·`WebSite` JSON-LD(name 산재맵)·사이트맵에 루트 복원 · README 갱신 절차에 `build_pages.py`
- [10-21] JSON-LD `isBasedOn` 을 출처 주소 문자열로(56badbe) — 서치콘솔 「데이터세트 잘못된 항목 1개」(내장 Dataset 에 description 없음) 해결
- [10-21] **구글 서치콘솔**: 색인 요청 `/sanjaemap/`·`r/seoul/`·`r/gyeonggi/`·`r/busan/` · 사이트맵 재제출 · **루트 URL 접두어 속성 `https://himnuszkorea.github.io/` 추가·HTML 태그 소유확인**(16a6bdb) · 루트 사이트맵 제출·색인 요청(검사 시 「Google에 등록되어 있지 않음」 — 넘김 기간 탓으로 추정)
- [10-21] **네이버 서치어드바이저**(Aside): 소유확인 유지 확인 · 사이트맵 2개 그대로 · 웹 페이지 수집 요청 19건(`/`·`/sanjaemap/`·시도 17) 이력 확인

## 4. 미완료 작업
- 검색 노출 관찰 — 진행: 게시·요청 전부 완료 / 남은 것: ① 구글 `…/sanjaemap/` 속성 사이트맵 상태 「가져올 수 없음」(10-21 제출 직후, 게시본은 200·XML·18주소로 정상) 재확인 ② 색인·순위·사이트 이름 관찰 ③ (선택) 구글 리치 결과 테스트에 `/sanjaemap/`·루트
- (선택) 위치 미확인 12곳 — 남은 것: `tools/build_data.py` `OVERRIDE` 에 현행 도로명 주소 추가 후 재실행

## 5. 주요 파일
- `index.html` — 머리 메타(구글 확인 태그·JSON-LD `WebApplication`), 필터 패널, `<footer>` 앞 `#about`, `?v=` 판 번호
- `app.js` — `init()`(끝에 `?sido=` 처리), `apply()`(필터·목록·fitBounds), `fillSgg()`, `renderMore()`, `VER`
- `style.css` — 색 토큰 `--k0~k6`·`--h0~h3`·`--o`, `#about`(데스크톱 max-height 35vh·휴대폰은 제한 없음)
- `tools/build_data.py` — CSV → `data/hospitals.json`(fields: code,name,zip,addr,tel,kind,sido,sgg,lat,lng,hk,desig,htel); 특진·소속기관은 `../claude-code/gj-hearing-clinic-map/data/clinics.json`
- `tools/build_pages.py` — hospitals.json → `r/<slug>/index.html` 17개 + `sitemap.xml`(생성물도 커밋 — Pages 는 빌드 없음, 끝에 건수 검산 「일치」)
- `tools/write_config.py`(.env.local → config.js) · `tools/og_image.py` · `tools/geocode_cache.json`
- `C:\claudecode\himnuszkorea.github.io\index.html` — 루트 안내 화면(「산재맵 열기」 버튼)·네이버/구글 확인 태그·`WebSite` JSON-LD · 같은 폴더 `sitemap.xml`·`robots.txt`

## 6. 핵심 판단 및 결정사항
- 호스팅 GitHub Pages(사용자 지시) / 탈락: Vercel 하위경로
- 화면용 브이월드 키는 `config.js` 로 공개(서비스 URL 제한 키) · `.env.local` 은 커밋 안 함
- 종류는 원자료에 없어 기관명으로 추정(화면·시도 페이지에 「추정」 표기)
- 네이버는 루트 저장소 경유 / 이유: 하위 경로를 코드 101로 거부
- 휴대폰 지도는 「두 손가락」 방식 / 탈락: 높이 축소만, gesture-handling 플러그인(외부 의존)
- **루트는 넘기지 않는 안내 화면(A안, 10-21 사용자 결정)** — 10-20 「바로 넘김」 대체. 구글이 사이트 이름을 호스트 첫 화면에서 읽는데 넘김이라 「GitHub Pages documentation」이 붙고 순위가 빠졌다(추정). 탈락: B안(넘김 유지·사이트 이름 포기). 루트 첫 화면 삭제도 탈락(네이버 소유확인 풀림)
- 소개 글은 하단 접이식 `details`(10-20 머리글 문구 삭제 요청 존중) — `display:none` 금지(숨긴 글 취급 위험)
- 시도 페이지 h1·title 숫자는 **지정의료기관 수**(서울 1,288) — 특진만 기관은 표에 「지정 목록 밖」. 메모 초안의 1,308(특진만 포함)은 부정확해 바꿈
- 구글 루트 속성은 URL 접두어 / 이유: 도메인 속성은 DNS 필요(github.io 불가)
- 공유 그림·아이콘에 십자 모양 쓰지 않음(적십자 표장 유사 회피)

## 7. 해결되지 않은 문제
- 증상: 구글 서치콘솔 `…/sanjaemap/` 속성 Sitemaps 표에서 `/sitemap.xml` 상태 「가져올 수 없음」, 발견된 페이지 0 / 재현: 10-18·10-21 제출 모두 / 확인한 것: 게시본 200·`application/xml`·XML 파싱 정상·18주소·robots.txt 에 명시 / 아직 안 한 것: 며칠 대기 후 재확인, 계속이면 `sitemap.xml?v=1` 로 다시 제출
- (의도된 처리) 위치 미확인 12곳은 목록에만 「위치 미확인」

## 8. 다음 작업 순서
1. 2026-10-25 무렵 구글 서치콘솔(내장 브라우저, 속성 `https://himnuszkorea.github.io/sanjaemap/`) 「Sitemaps」 상태가 「성공」으로 바뀌었는지 보고, 그대로면 `sitemap.xml?v=1` 로 다시 제출 · 「페이지」 보고서에서 `r/*` 색인 수 확인
2. 같은 날 루트 속성(`https://himnuszkorea.github.io/`) URL 검사로 루트 색인 여부 확인 · 시크릿 창에서 「산재맵」·「서울 산재 지정병원」 검색해 순위·사이트 이름 기록
3. 1~3주 서치콘솔 「실적」에서 검색어 「산재맵」 평균 게재순위 관찰 — 하루 결과로 되돌리지 말 것
4. (선택) 위치 미확인 12곳 `OVERRIDE` → `py -3 tools/build_data.py raw/hospitals_20251231.csv` → `py -3 tools/build_pages.py` → 커밋·푸시
5. 2027-06-30 이후 새 CSV 갱신(README 「갱신 절차」) — `#about`·설명·공유 그림·루트 첫 화면 숫자(6,742·220·78)도 손으로 고친다

## 9. 주의사항
- **주소 `himnuszkorea.github.io/sanjaemap` 와 시도 페이지 slug(seoul…jeju)를 바꾸지 말 것** — 공모전 A03 카드뉴스·A02 원고에 주소가 박혀 있다(10-19)
- A02 는 제출 완료 — 원고의 「화면 맨 위에」 문구 어긋남은 더 다루지 않는다(10-20 사용자 결정)
- 하단 비공식 문구(`app.js` `$("foot")`)를 지우지 말 것 — 공모전 원고가 인용한다
- 확인 태그 삭제 금지: 산재맵 `index.html` `google-site-verification`, 루트 `index.html` `naver-site-verification`·`google-site-verification`(10-21, 같은 값)
- 루트에 자동 넘김(location.replace·meta refresh·타이머)을 다시 넣지 말 것 — A안 효과가 사라진다
- 화면 파일을 고치면 `index.html` `?v=`(3곳)와 `app.js` `VER` 를 함께 올린다(Pages 10분 캐시)
- 공개 저장소 — 커밋 전 `.env.local`·키 미포함 확인(`config.js` 브이월드 키만 의도된 공개)
- 원본 CSV 는 CP949 · 광주·전남은 「전남광주통합특별시」 정제 주소라 원본 표기·구 이름으로 가른다 · 브이월드 지오코더는 수백 건마다 502(재시도 5회)
- 네이버 「웹 페이지 수집」 입력칸은 경로만 넣으면 「올바른 URL 형식」으로 거부 — 전체 주소를 넣고, 요청마다 몇 초 기다린다. 앱 내장 브라우저는 searchadvisor 를 막으므로 Aside(로그인은 사용자)
- 서치콘솔 URL 검사는 주소창 직접 이동이 404 — 개요 화면 위 검색 아이콘으로 연다
- 내장 브라우저 창이 숨겨져 있으면 지도 fitBounds 애니메이션·IntersectionObserver 가 멈춘 것처럼 보인다 — 스크린샷을 찍어 그리게 한 뒤 판단(10-20·10-21)
- 미리보기는 루트 `C:\claudecode\.claude\launch.json` 의 `sanjaemap`(8765)
