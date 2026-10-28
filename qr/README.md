# QR코드 만들기

공개 주소: https://kjelab.kr/qr/

참고 자료 URL을 정적 QR코드로 바꾸는 브라우저 도구입니다. 웹 주소를 QR에 직접 저장하며, 리디렉션 서비스·외부 QR API·로그인·브라우저 저장소를 사용하지 않습니다. 별도 빌드나 서버 없이 루트 GitHub Pages에서 제공합니다.

- PNG: 1024×1024, 정수 픽셀 단위 모듈, 사방 4모듈 이상의 흰 여백
- SVG: 원본 모듈 격자와 4모듈 여백
- 자료 제목, 링크 열기, 확대 대화상자, 제목·주소를 포함하는 A4 인쇄
- 입력이 바뀌면 이전 결과를 숨겨 잘못된 QR 저장 방지
- http/https URL만 허용. 한글 URL은 URL 표준에 따라 인코딩. 최대 2000바이트
- 오류 정정 수준 M, 버전 자동 선택

`vendor/qrcode-2.0.4.js`는 저장소의 출석 도구에서도 사용하는 qrcode-generator 2.0.4(Kazuhiko Arase, MIT)입니다. 라이선스는 `vendor/LICENSE-qrcode.txt`에 보존했습니다. 원본: https://github.com/kazuhikoarase/qrcode-generator

검증: `node --test qr/tests/core.test.cjs`

배포 전 일반 링크, 쿼리·해시, 한글 URL, 긴 URL의 생성 이미지를 독립 QR 디코더로 읽어 주소가 일치하는지 확인합니다. 생성·입력 수정·PNG/SVG 저장·확대·모바일 화면도 브라우저에서 확인합니다.
