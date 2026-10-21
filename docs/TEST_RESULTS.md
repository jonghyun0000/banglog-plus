# 검증 기록

## 2026년 10월 21일 팀 피드백 반영

- 타입 검사, ESLint, Prettier, 서버·웹 빌드 및 hosted 데모 빌드 통과.
- 단위·API·어댑터·브라우저 메모리 테스트 88개 통과. 새 유형의 모든 증상 값과 교차 유형 입력 거부, 통상 마모·입주 전 손상·직접 소유 제품·상충 주장·위험 상황·지원 범위 검증 포함.
- 실제 격리 PostgreSQL 검사 16개 통과. 새 유형 저장·삭제와 기존 소유권·RLS·불변 출처 버전 확인.
- 기존 Playwright 13개 통과. 360/390/1440px, 200% 확대, 수정·뒤로가기·취소·오류·복사·삭제 포함.
- hosted Playwright 로컬 8개 및 실제 https://banglog-plus.vercel.app 에서 8개 통과. 여섯 유형 전체 흐름, 판례 원문·적용 한계 화면, 직접 소유 냉장고의 수리업체 연락 경로 포함.
- 가상 시나리오 60/60 기대값 일치. 고정 holdout을 변경하지 않았다. 법률 정확도를 뜻하지 않는다.
- 자동 접근성 검사에서 판례 화면의 h1→h3 순서 누락 발견 후 h2 추가로 수정. 기존 뒤로가기 테스트는 변경된 질문 제목에 맞게 기대 문구를 수정했고 동작 검증을 유지했다.
- 새 유형 DB migration을 기존 로컬 DB에도 적용하고 제약 확인. 기존 데이터를 보존했고 작업 후 DB를 원래의 중지 상태로 돌렸다. 원격 DB는 변경하지 않았다.
- 기존 로컬 DB를 별도 복제해 사용하는 개발자는 `supabase/migrations/20261021022508_expand_repair_issues.sql`을 해당 DB 소유자 연결에서 적용해야 한다. 신규 로컬 DB는 모든 migration을 순서대로 적용한다.

## 2026년 10월 15일 초기 검증


| 명령·검증 | 결과 | 범위 |
| --- | --- | --- |
| npm install | 성공 | exact 의존성·package-lock. 설치 audit 0 vulnerabilities |
| npm run typecheck | 통과 | React/API/shared/scripts/tests TypeScript |
| npm run lint | 통과 | ESLint·React Hooks |
| npm test | 69/69 통과 | 40 개발 사례, 중립성·근거·권한·오류·경합·SDK 테스트 |
| npm run db:test | 15/15 통과 | 실제 PostgreSQL 17.10 마이그레이션·제약·RLS·예산·API |
| npm run test:e2e | 13/13 통과 | Chromium, 3 viewport, 세 유형, 수정·복사·피드백·삭제·상태·확대 |
| npm run evaluate | 60/60 규칙 기대값 일치 | 개발40+고정20. 법률 정확도 아님 |
| npm run format:check | 통과 | 전체 코드 포맷 |
| npm run build | 통과 | 웹 dist + 서버 dist-server |
| npm run db:local / dev:db | 성공 | SCRAM·제한된 앱 LOGIN의 실제 local DB 모드 |
| 브라우저→API→로컬 DB smoke | 통과 | 결과1·피드백1 저장 → 삭제 후 guest/result/feedback 모두0 |
| 브라우저 bundle 검사 | 통과 | 서버 환경변수명·키 패턴·SQL/DB role 코드 없음 |
| axe 자동 접근성 | 위반 0건 | 세 viewport의 홈·질문·결과. 전체 접근성 인증 아님 |

현재 결과 파일: `db-test-results.json`, `evaluation-results.json`, `local-db-smoke.json`, `bundle-check.json`. 모든 테스트는 가상 입력만 사용했다.

## 발견한 실패와 수정
1. 초기 타입 검사: PoolClient 명시 타입과 unknown 오류 좁히기 누락 → 타입 수정 후 통과.
2. 초기 lint config의 괄호 누락 → 설정 문법 수정. 규칙 비활성화로 회피하지 않음.
3. 초기 E2E 3건 실패: DELETE 요청에 body 없이 Content-Type: application/json을 붙여 Fastify가 400 반환 → body가 있을 때만 헤더 설정. 삭제 확인 assertion을 유지한 채 재실행 통과.
4. 긴 결과에서 한국어 어절이 잘림 → keep-all 및 overflow-wrap 조합.
5. 질문 아래 위험 안내가 길게 밀릴 수 있음 → 상단 경고와 최초 위험 인식 시 scrollIntoView. 위험 기본값은 ‘모름’으로 설정.
6. format:check가 서버 파일 1개 지적 → formatter 적용. 검증 설정을 완화하지 않음.

## 실행하지 않은 검증
- 실제 OpenAI 네트워크 호출·모델 품질·실제 토큰 청구·조직 보관 설정: OPENAI_API_KEY/OPENAI_MODEL 없음.
- 원격 Supabase / HYUNDO Master 적용·Data API HTTP 테스트·Supabase 전체 Docker 스택·advisors: 연결 정보·승인 없음, Docker daemon 비실행. SQL 역할 차단은 실제 local PostgreSQL로 검증.
- 토스 SDK bundle·콘솔·QR·실기기·심사: SDK/권한/appName 없음, 카테고리 제한 존재.
- 사람 5명 3초 이해·현장 사용성·법률 기준 답안·개인정보 검토: 사람 검토 미실행.
- Safari/iOS/Android 실제 키보드·스크린리더·OS 확대: Chromium viewport/글꼴 확대/키보드 가용 높이 모사만 검증.
- 공개 배포·정리 scheduler 가용성·공급자/백업 삭제: 미배포.

네트워크 로딩/오류 캡처는 테스트에서 응답을 지연·실패시켜 만든 검증 상태다. 제품은 가짜 진행률이나 분석 정확도를 표시하지 않는다.

## 2026-10-15 GitHub / Vercel 배포 추가 검증

단위/API/SDK/브라우저 메모리 72개, 실제 PostgreSQL 15개, 기존 Playwright 13개, 로컬 정적 체험판 Playwright 3개, 실제 Vercel 주소 Playwright 3개 모두 통과. 타입·린트·format·기본 웹/서버 빌드 및 hosted 빌드 통과. 배포 대상·한계·실행 결과는 DEPLOYMENT.md 참조. 실제 AI 호출과 원격 DB 적용은 여전히 0건.
