# 방로그 Plus 배포

2026-10-15 사용자의 GitHub 업로드·Vercel 배포 요청에 따른 작업.

- GitHub 대상: `jonghyun0000/banglog-plus`, 비공개 저장소.
- Vercel 대상: `jonghyun0000s-projects` 팀의 새 `banglog-plus` 프로젝트. 기존 `banglog` 프로젝트는 변경하지 않는다.
- 빌드: Node 22.x, `npm ci`, `npm run build:demo`, 출력 `dist`.
- 체험판: 입력·가상 결과·피드백은 브라우저 메모리에만 존재. 새로고침/닫기/삭제 시 사라짐. 피드백 운영자 전송 없음. 실제 AI, 원격 DB, Fastify API 배포 없음.
- `.local`, `.env*` (빈 예시 제외), `.vercel`, 설치 파일/빌드 결과는 Git에서 제외. 로컬 DB와 비밀번호를 업로드하지 않음.
- 검색 엔진 색인 제외 헤더 적용. 가상 결과임을 화면에 표시. 실서비스 공개 출시 승인이나 법률 검토 완료를 뜻하지 않음.

## 로컬 검증

타입 검사·린트 통과, 단위/API/AI 어댑터/브라우저 메모리 테스트 72개 통과, 실제 PostgreSQL 검사 15개 통과, 기존 서버·웹 빌드 성공. 브라우저 검사와 실제 배포 결과는 아래 기록.

기존 Playwright 13개와 정적 체험판 Playwright 3개 통과. 세 문제의 결과·복사·피드백·삭제·새로고침·접근성 검사 통과. 체험판에서 fetch/XHR/POST 요청 0개, localStorage/sessionStorage 0개, 페이지 오류 0개 확인. format 검사 통과.

## 실제 배포 및 검증 완료

- GitHub: https://github.com/jonghyun0000/banglog-plus (private, 기본 브랜치 main)
- 사이트: https://banglog-plus.vercel.app
- Vercel 관리: https://vercel.com/jonghyun0000s-projects/banglog-plus
- 프로젝트 ID: prj_D2NW7h6HvebQhycmlVmLxc9LpcsD
- GitHub 연동 완료. main push로 production 배포가 자동 실행되는 것을 확인했다.
- 최초 검증 배포: dpl_AWnbduw8EQSvQgAhBnorLtUB6kZf / 코드 커밋 572b2cd7e6c79d39b2deacd94f8809e5f0a9935e. 2026-10-15 21:48 KST Ready. 이후 문서 정리 커밋도 같은 코드로 자동 배포된다.
- Vercel 빌드 로그에서 Node 22.x, npm ci 성공, 취약점 감사 0건, build:demo 성공 확인. 실제 Vercel 프로젝트 기본 Node 설정은 24.x이나 package.json의 >=22.12.0 <23 범위가 우선하여 22.x를 사용한다.
- 공개 주소 HTTP 200, noindex/nofollow·nosniff·Referrer-Policy 헤더 확인.
- 실제 공개 주소에서 Playwright 3개 모두 통과: 곰팡이·누수·보일러 질문 → 결과 → 실제 클립보드 복사 → 체험용 피드백 → 삭제 → 새로고침. 접근성 위반 0개, 페이지 오류 0개, fetch/XHR/POST 0개, localStorage/sessionStorage 0개.
- 배포 JS에 browser-demo-rules 표시 존재. 서버 API 경로, OPENAI_API_KEY, DATABASE_URL 이름은 포함되지 않음.
- MCP는 팀 범위 권한 오류가 있어 동일한 사용자 팀의 기존 인증된 Vercel CLI 64.2.0으로 연결·검증했다. 토큰을 읽거나 출력하지 않았다.

## 유지보수

`git push origin main` → Vercel 자동 빌드 → Ready 확인. 기능 변경 시 `npm run test:hosted`와 실제 사이트에 대한 `HOSTED_URL=https://banglog-plus.vercel.app npm run test:hosted`를 실행한다. 기존 서버 모드 검증은 AGENTS.md의 명령을 따른다. 서버 API와 DB를 실제 배포하는 작업은 현재 체험판과 구분해서 진행해야 한다.

## 2026년 10월 21일 업그레이드

동일한 `banglog-plus` 프로젝트에 6종 문제와 판례 참고 화면을 배포했다. Vercel은 기존 browser-only 빌드를 유지한다. 로컬 검증 결과와 미검증 범위는 TEST_RESULTS.md, 팀 의견 반영과 발표 초안은 TEAM_FEEDBACK.md, 출처별 상태는 RESEARCH.md에 기록했다. 원격 DB migration이나 유료 자원을 추가하지 않았다.

- 기능 커밋: `d0bc89bedf75e9fed14ceb3991e1246133829963`.
- 검증한 Production 배포: `dpl_27Hohu2g9A3DkDuaLwLWkLsg6f14`, READY, 빌드·준비 약 24초.
- 실제 주소: https://banglog-plus.vercel.app
- Vercel 빌드 로그와 GitHub Vercel status에서 위 커밋의 배포 성공 확인. Node 22.x, npm ci, build:demo 성공.
- 공개 주소에서 hosted Playwright 8/8 통과: 여섯 유형 전 과정, 참고 판례, 직접 소유 제품의 수리업체 경로. 검사한 화면의 axe 위반 0건. 여섯 전 과정에서 pageerror·fetch/XHR·비GET 데이터 요청·지속 저장 0건.
- 이후 문서만 정리하는 커밋은 기능 코드가 동일하며 기존 main 자동 배포를 따른다.
