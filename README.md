# KJE의 작업실

과학교육을 바탕으로 수업과 탐구, 디지털 제작을 연결하는 포트폴리오.

- 홈페이지: https://maehwachem.github.io/
- 연락처: kjechem@naver.com
- GitHub Pages의 `main` 브랜치 루트에서 서비스하는 정적 페이지입니다.

## 파일

- `index.html`: 소개, 분류별 프로젝트 목록, 탐구, 일상 관심, 연락처. 별도 빌드 없이 실행됩니다.
- `assets/student-character.png`: 상단 ‘KJE의 작업실’에 사용하는 학생 캐릭터.
- `.nojekyll`: 정적 파일을 그대로 서비스합니다.

## 프로젝트 관리

`index.html`의 `#kje-project-list` 안에 있는 `<article class="kje-project">`를 수정합니다.

각 항목의 `data-kind` 값은 다음 중 하나입니다.

- `lab`: 가상실험
- `game`: 학습 게임
- `tool`: 교육 도구
- `lesson`: 수업·탐구 자료

제목, 설명, 과목 태그와 실제 링크를 각 항목에 함께 둡니다. 아직 링크가 없는 작업은 ‘공개 준비 중’으로 표시합니다. 공개할 때 해당 표시를 실제 `<a>` 링크로 바꾸면 됩니다. 필터별 개수는 자동으로 계산됩니다.

기존 배터리·센서 도구, 저장소 링크와 개인정보 처리방침 링크를 유지했습니다. 학습 도구 자체는 별도 저장소에서 관리합니다.

프로젝트 분류별 주소도 사용할 수 있습니다: `#projects-lab`, `#projects-game`, `#projects-tool`, `#projects-lesson`.
