# 우리 반의 하루

공개 주소: https://kjelab.kr/classroom-day/

## HTML 관리

- 실행 파일은 이 폴더의 index.html입니다. CSS, JavaScript, React와 아이콘이 모두 포함되어 별도 CDN이나 앱 서버 없이 GitHub Pages에서 화면이 실행됩니다.
- 새 HTML로 교체하려면 GitHub에서 classroom-day/index.html을 업데이트하고 저장합니다. Pages 배포 후 반영됩니다.
- 포트폴리오 소개와 실행 링크는 content/projects.json의 교육 도구 목록에서 관리합니다.
- 편집 가능한 원본은 src/에 있습니다. 원본을 수정했다면 이 폴더에서 npm install 후 npm run build를 실행해 index.html을 갱신합니다. React와 Lucide의 라이선스 고지는 HTML 번들에 포함됩니다.

## 실제 자료 연결

- HTML은 기존 데이터 조회 서버 https://classroom-day.kjeung.chatgpt.site/api/data 를 호출합니다. 화면을 외부 사이트로 이동시키거나 iframe에 넣지 않습니다.
- 나이스 인증키는 이 HTML이나 GitHub에 포함하지 않습니다. 기존 ChatGPT Sites 서버의 NEIS_API_KEY 비밀 환경변수를 사용합니다.
- 날씨·대기질은 공공데이터포털의 두 서비스 활용신청 후 같은 서버의 DATA_GO_KR_KEY를 등록하고 재배포해야 합니다.
- 서버는 kjelab.kr 및 maehwachem.github.io의 브라우저 요청에 CORS 응답을 허용합니다. CORS는 API 인증이나 호출량 제한을 대신하지 않습니다.
- 서버를 중지하거나 삭제하면 실제 자료 조회는 중단됩니다. 예시 화면과 이 브라우저의 메모는 계속 사용할 수 있습니다.

## 저장 범위

학교 설정과 알림 메모는 브라우저의 localStorage에 저장됩니다. 기존 chatgpt.site와 kjelab.kr은 주소가 달라 저장 내용이 자동 이동하지 않습니다. 새 주소에서 학교를 다시 선택하세요. 학생 개인정보나 인증키는 저장하지 않습니다.

## 확인 범위

단일 HTML 생성과 스크립트 구문, 내부 이동 경로 및 CORS 허용·차단 동작을 점검했습니다. 실제 제공기관 응답은 배포 뒤 학교를 검색해 확인해야 합니다.
