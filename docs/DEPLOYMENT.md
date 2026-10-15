# 방로그 Plus 배포

2026-10-15 사용자의 GitHub 업로드·Vercel 배포 요청에 따른 작업.

- GitHub 대상: `jonghyun0000/banglog-plus`, 비공개 저장소.
- Vercel 대상: `jonghyun0000s-projects` 팀의 새 `banglog-plus` 프로젝트. 기존 `banglog` 프로젝트는 변경하지 않는다.
- 빌드: Node 22.x, `npm ci`, `npm run build:demo`, 출력 `dist`.
- 체험판: 입력·가상 결과·피드백은 브라우저 메모리에만 존재. 새로고침/닫기/삭제 시 사라짐. 피드백 운영자 전송 없음. 실제 AI, 원격 DB, Fastify API 배포 없음.
- `.local`, `.env*` (빈 예시 제외), `.vercel`, 설치 파일/빌드 결과는 Git에서 제외. 로컬 DB와 비밀번호를 업로드하지 않음.
- 검색 엔진 색인 제외 헤더 적용. 가상 결과임을 화면에 표시. 실서비스 공개 출시 승인이나 법률 검토 완료를 뜻하지 않음.

## 로컬 검증

타입 검사·린트 통과, 단위/API/AI 어댑터/브라우저 메모리 테스트 72개 통과, 실제 PostgreSQL 검사 15개 통과, 기존 서버·웹 빌드 성공. 브라우저 검사와 실제 배포 결과는 완료 후 아래 기록.

기존 Playwright 13개와 정적 체험판 Playwright 3개 통과. 세 문제의 결과·복사·피드백·삭제·새로고침·접근성 검사 통과. 체험판에서 fetch/XHR/POST 요청 0개, localStorage/sessionStorage 0개, 페이지 오류 0개 확인. format 검사 통과.
