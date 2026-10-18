# Session Summary
최종 갱신: 2026-10-18 (노트북)

## 1. 목적
근로복지공단 산재보험 지정의료기관(공공데이터포털, 6,742곳, 2025-12-31 기준)을 청력 특진 지도
(`claude-code/gj-hearing-clinic-map/`)처럼 검색되는 지도로 만들어 **GitHub Pages**(사용자 지시, 무료)로 공개한다.

## 2. 현재 상태
화면(`index.html`·`style.css`·`app.js`)·전처리(`tools/build_data.py`)·README 완성, 로컬 미리보기로 검색·시도/시군구·종류·
청력 특진 필터·거리순·길찾기·모바일 폭 확인. **좌표는 아직 129곳뿐**(특진 지도 캐시분) — 브이월드 새 키를 기다린다.
로컬 git 커밋만 있고 GitHub 저장소·Pages 는 아직 없다.

## 3. 다음 작업
1. **(사용자)** 브이월드에서 서비스 URL `https://himnuszkorea.github.io` 로 키 발급 → `sanjaemap/.env.local` 에 `VWORLD_KEY=...`
2. `py -3 tools/build_data.py raw/hospitals_20251231.csv` (새 주소 약 6,600개, 백그라운드 30~40분, 이어받기 가능) → 실패 목록 확인, 필요하면 `OVERRIDE` 추가
3. `py -3 tools/write_config.py` → 미리보기 재확인 → 커밋
4. **(사용자 승인 후)** `gh repo create himnuszkorea/sanjaemap --public --source . --push` → Pages(main / root) 켜기 → 운영 주소에서 타일·데이터 확인
5. (선택) 청력 특진 지도에서 이 지도로 링크 한 줄

## 4. 결정
- 호스팅: GitHub Pages(사용자 10-18) — 공개 저장소 필요라 private `claude-code` 와 분리한 별도 저장소. Vercel 하위경로안은 탈락.
- 화면용 브이월드 키는 `config.js` 로 공개(프런트엔드 키는 어차피 노출) — 서비스 URL 제한으로 막는다. 좌표 생성용 `.env.local` 은 커밋 안 함.
- 종류는 원자료에 없어 **이름으로 추정**(화면에 표기). 기타 30곳은 「의료법인 ○○의료재단」 등 이름만으론 모르는 곳.
- 지오코딩 규칙은 특진 지도 `build_data.py` 에서 복사(저장소가 달라 import 안 함) — 고칠 땐 두 곳을 같이 본다.
- 목록은 200곳씩 그리고 「더 보기」, 지도는 markercluster + canvas.

## 5. 함정
- 원본 CSV 는 **CP949**. 시도 표기가 「서울/서울특별시」, 「세종/세종시」 등 섞여 있어 `SIDO_SHORT` 로 맞춘다.
- 이름 앞 괄호(「(의료법인)…」)가 이름순 정렬을 흐려 정렬용 이름에서 뺀다.
- 미리보기 설정은 루트 `C:\claudecode\.claude\launch.json` 의 `sanjaemap`(8765) — 하위 폴더 launch.json 은 안 읽힌다.
