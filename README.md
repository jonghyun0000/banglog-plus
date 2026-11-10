# 현재 작업 기준 · 2026-11-10

현재 서비스는 v1.3, Fastify API + PostgreSQL 근거 검색 + 실제 GPT 및 선택 사진 분석 + 회원 기록 구조입니다. 브라우저 데모는 별도 `build:demo`입니다. 아래 초기 기록을 현재 운영 상태로 해석하지 마세요.

최신 인계: [HANDOFF_CLAUDE.md](HANDOFF_CLAUDE.md). 통합 검토: [PR1_INTEGRATION.md](docs/PR1_INTEGRATION.md). 이번 통합 브랜치는 미병합·미배포입니다.

---

# 방로그 Plus · 배포 1 (v1.0.0)

- 사이트: https://banglog-plus.vercel.app/
- 관리자: https://banglog-plus.vercel.app/admin
- 현도 마스터 Plus 전용 DB → 정제 법률 자료 검색 → GPT-6.1 Sol 응답을 연결한다. GPT 오류에는 기본 안내로 전환한다.
- 현도컴퍼니 이메일 계정을 재사용한다. 신규 가입과 인증 메일 재발송을 지원하며 비회원 이용도 가능하다.
- 관리자에서 이용 통계·선택 답변·판례·회원 제한/기록 삭제·연결 점검·관리 이력을 확인한다.
- 최신 운영 구성은 [계정과 데이터](docs/ACCOUNTS_AND_DATA.md), 실제 배포 확인은 [검증 결과](docs/release-verification.json)를 따른다.

아래는 이전 개발 단계 기록이다. 현재 운영 상태와 다른 설정 설명은 위 최신 문서를 우선한다.

---

# 방로그 Plus


## 2026-11-03 계정·데이터 관리 추가

사용자 승인으로 HYUNDO Master에 `banglog_plus` 전용 스키마와 15개 RLS 테이블을 생성했습니다. 법률 출처 4개·검색 문단 4개는 내부 검토용입니다. 기존 `banglog` 서비스는 변경하지 않았습니다.

구글·카카오 로그인, 본인 기록 저장/조회/삭제, 식별자 없는 일일 결과·선택 답변 집계를 구현했습니다. **실제 두 OAuth 제공자는 아직 비활성화이고, 공개 웹의 운영 API 연결과 실제 GPT 호출은 미설정입니다.** 회원 기록은 사용자가 명시적으로 저장하며 90일/100개까지 보관합니다. 비회원 임시 기록은 24시간입니다.

설정·권한·검증·원격 마이그레이션 대응표: [ACCOUNTS_AND_DATA.md](docs/ACCOUNTS_AND_DATA.md). 집계 조회: [USAGE_REPORT.sql](docs/USAGE_REPORT.sql).

기존 로컬 DB에는 `npm run members:setup`으로 새 테이블을 준비한 뒤 `npm run dev:db`를 사용합니다. 새 로컬 DB는 전체 마이그레이션이 적용됩니다.

전·월세 세입자를 위한 AI 수리 가이드. **곰팡이·결로, 누수, 보일러 고장**의 상황 입력 → 7단계 질문 → 확인·수정 → 조건부 결과 → 문구 편집·복사 → 선택 피드백을 연결한 독립 MVP입니다.

기존 방로그 코드를 재사용하지 않았습니다. 기본 실행은 **가상 결과 + 서버 메모리**입니다. 실제 OpenAI·Supabase 원격 연동, 법률가 검토, 토스 승인까지 완료됐다는 의미가 아닙니다.

## Vercel 체험판

- [배포 사이트](https://banglog-plus.vercel.app)
- [GitHub 비공개 저장소](https://github.com/jonghyun0000/banglog-plus)
- `main` 브랜치 push 시 Vercel 자동 배포.

배포 빌드: `npm run build:demo`. `vercel.json`이 이 명령과 `dist`를 사용합니다.
브라우저 메모리에서 규칙 기반 가상 결과를 생성하며 입력·결과·피드백을 API나 외부 AI로 전송하지 않습니다. 피드백은 운영자에게 전달되지 않습니다. 새로고침·페이지 닫기·기록 삭제 시 사라집니다. 사이트 파일을 요청하는 일반 호스팅 접속 기록과는 구분됩니다.

`npm run build`와 `npm run dev`는 기존 서버 API 모드를 유지합니다. 실제 AI·원격 DB 서비스를 가동하려면 별도 서버 배포 및 환경 설정과 출시 전 검토가 필요합니다. 현재 Vercel 설정은 Fastify 서버를 실행하지 않습니다.

배포 검증: `npm run test:hosted` 또는 `HOSTED_URL=https://배포주소 npm run test:hosted`. 여섯 문제의 질문 → 결과 → 복사 → 피드백 → 삭제 → 새로고침을 검사하고, 입력 전송·지속 저장·브라우저 오류가 없는지 확인합니다.

## 2026년 10월 팀 피드백 반영

벽지·장판 4가지 손상, 배수 4가지 증상, 옵션 8가지 선택(가전·수납장·침대·기타)과 모름 경로를 추가했습니다. 증상은 사용자 선택으로 기록하며 사진 자동 판독은 제공하지 않습니다. 홈과 결과에서 두 대법원 판결의 원문·적용 한계를 확인할 수 있습니다.

[팀 피드백 반영 및 발표용 기획안](docs/TEAM_FEEDBACK.md) · [자료 검증 및 경쟁 서비스 조사](docs/RESEARCH.md)

## 2026-11-03 DB 근거 기반 AI 연결

공식 자료 4건·요약 문단 4개를 담은 [초기 데이터셋](data/repair-knowledge.v1.json)과 PostgreSQL 검색 경로를 추가했습니다. 내부 실제 AI 모드는 DB 검색을 먼저 실행하고 검색된 설명·출처 버전만 AI에 전달합니다. 근거 없음·검색 실패 시 AI 호출을 중단하며, 인용과 검색 문단 이력을 결과에 저장합니다. 초기 검색은 문제 유형·증상·키워드 방식입니다.

로컬 DB 시작 후 `npm run knowledge:setup`으로 자료를 준비하고 `npm run dev:db`로 실행합니다. 기본 AI는 여전히 `mock`이며 공개 Vercel 데모·유료 AI 실호출은 변경하지 않았습니다. 원격 DB 초기 구조와 자료는 승인 후 HYUNDO Master에 반영했습니다. [구조·자료·실행·검증 범위](docs/KNOWLEDGE_PIPELINE.md)를 확인하세요.

## 바로 실행

Node **22.12 이상** 필요. 구현 검증 환경은 Node 22.18.0, npm 10.9.3입니다.

```sh
cd '/Users/jonghyun/Desktop/방로그 puls'
npm ci
npm run dev
```

[브라우저 데모](http://127.0.0.1:5173)를 여세요. API는 `127.0.0.1:8787`, Vite가 `/api`를 프록시합니다. 키나 `.env` 없이 전체 데모를 사용할 수 있습니다. 종료는 Ctrl+C입니다. 5173 또는 8787 포트를 다른 앱이 사용하면 먼저 해당 앱을 확인하세요.

## 구현한 기능

- 가입을 강제하지 않는 한국어 모바일 폼과 선택적인 구글·카카오 로그인. 유형별 증상, 발견 시점, 기존 상태, 설치 주체, 원인 설명의 출처, 상충 주장, 계약 문장, 연락 여부.
- 위험 표현을 입력 중 즉시 안내. 지원 범위 밖 입력은 별도 상태. 원문 속 명령문은 지시로 사용하지 않음.
- 점검 요청 상대와 비용 방향 분리. 집주인/세입자 부담 검토, 복합 원인, 판단 보류. 제3자·공용부분은 관리 담당자 경로.
- 수정 시 입력 버전 갱신, 이전 결과 무효화. 원인 불명·기사 소견 전달·집주인 주장을 구분.
- 최초 요청/비용 확인/답변 확인 문구, 편집·실제 클립보드 복사, 실패 시 수동 복사 안내. 자동 발송 없음.
- 선택 피드백, 현재 세션 삭제, 24시간 만료, 요청 제한·멱등성·취소·오류 구분.
- 서버 전용 OpenAI 구조화 출력 어댑터, 메모리/PostgreSQL 저장소, 사설 스키마·RLS·불변 출처 버전.

## 로컬 실제 DB 모드

`initdb`, `pg_ctl`이 PATH에 있어야 합니다. 테스트에 사용한 로컬 엔진은 PostgreSQL 17.10입니다. 원격 Supabase가 아니라 별도의 로컬 PostgreSQL입니다.

```sh
npm run db:local
npm run dev:db
# 개발 서버 종료 후 DB도 중지하려면
npm run db:stop
```

DB는 `127.0.0.1:54329`, 데이터는 `.local/postgres/`에 생성합니다. 임의 비밀번호와 제한된 앱 역할을 설정하고 비밀값은 출력하지 않습니다. `.local/database.env`는 0600 권한이며 Git에서 제외됩니다. 기존 데이터 폴더는 덮어쓰지 않습니다. 이 명령은 원격 DB를 건드리지 않습니다. DB 모드에서도 AI는 기본 mock입니다.

## 검증 명령

```sh
npm run typecheck
npm run lint
npm test
npm run db:test
npm run test:e2e
npm run evaluate
npm run build
```

`test:e2e`는 자체 서버를 띄우므로 실행 중인 개발 서버를 종료한 뒤 실행하세요. 처음에는 `npx playwright install chromium`이 필요합니다. `db:test`는 격리된 임시 PostgreSQL을 생성해 검사 후 정리합니다. `evaluate`는 60개 가상 사례의 **소프트웨어 규칙 일관성**이며 법률 정확도 측정이 아닙니다.

캡처는 `docs/screenshots/`, DB 결과는 `docs/db-test-results.json`, 평가 결과는 `docs/evaluation-results.json`입니다. 사람 5명 대상 3초 이해 테스트는 미실행입니다.

## 실제 AI·원격 DB 준비

`.env.example`을 참고해 서버 `.env`를 작성합니다. 비밀키를 `VITE_` 변수에 넣지 마세요.

| 변수                                                                         | 용도                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `AI_MODE=live`                                                               | 실제 공급자 선택. 기본 mock                             |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                                             | 서버 키와 운영자가 확인한 명시적 모델. 기본 모델 없음   |
| `REPOSITORY=database`, `DATABASE_URL`                                        | 서버 전용 직접 PostgreSQL 연결                          |
| `DATABASE_SSL=require`                                                       | 원격 TLS 검증. disable은 loopback에만 허용              |
| `INTERNAL_LIVE_ENABLED=true`                                                 | 내부 검증용 실제 모드                                   |
| `PROVIDER_RETENTION_ACK=true`                                                | 운영자가 공급자 보관 조건 확인                          |
| `MAX_DAILY_CALLS`, `MAX_DAILY_TOKENS`, `MAX_CONCURRENT`, `MAX_OUTPUT_TOKENS` | 호출·토큰·동시성 제한                                   |
| `INPUT_USD_PER_MILLION`, `OUTPUT_USD_PER_MILLION`, `DAILY_BUDGET_USD`        | 셋 모두 있을 때 보수적 비용 예약. 미설정 시 비용 미산정 |
| `ALLOWED_ORIGINS`, `HOST`, `PORT`                                            | API 호스트·포트·명시적 Origin 목록                      |
| `VITE_API_BASE_URL`                                                          | 별도 배포 API의 공개 주소. 기본 같은 Origin `/api`      |
| `PUBLIC_LAUNCH_ENABLED`                                                      | 기본 false. 현재 true로 바꿔도 공개 운영 차단           |

실제 모드는 키·명시적 모델·DB·내부 플래그·보관 확인·출처 조건이 없으면 요청을 차단합니다. 오류를 mock 성공으로 바꾸지 않습니다. DB 마이그레이션은 별도 승인 후 적용하며 연결은 [DATABASE](docs/DATABASE.md)를 따릅니다. HYUNDO Master 식별 정보는 제공받지 않았습니다.

설정과 내부 API 실행 후 실제 평가를 명시적으로 요청할 때만 `npm run evaluate -- --live --max-calls=3`을 사용할 수 있습니다. 1~5회만 허용하고 API의 일일 예산 검사도 적용합니다. 현재 실제 유료 호출은 실행하지 않았습니다.

## 빌드·운영 경계

`npm run build` → `dist/` 웹, `dist-server/` API. `npm start`는 API만 시작합니다. 배포 시 정적 웹 서버와 `/api` 프록시 또는 HTTPS API 주소/CORS를 별도 설정해야 합니다. 공개 배포는 하지 않았습니다.

API는 단일 인스턴스만 지원하며 DB advisory lock으로 중복 서버를 막습니다. 서버는 시작 시와 1분 간격으로 만료 정리를 수행합니다. 별도 스케줄러에서도 `npm run db:cleanup`을 1분 주기로 실행할 수 있습니다. 서버 중단 중에는 정리가 지연되므로 운영 스케줄러·모니터링 검증이 공개 전 필수입니다.

## 구조와 인계

`src/` 화면·플랫폼 / `shared/` 타입·질문·안전 / `server/` API·규칙·AI·저장소·출처 / `supabase/` 마이그레이션·권한 검사 / `tests/` 단위·통합·E2E / `fixtures/` 40 개발 + 20 고정 평가 / `docs/` Notion에 옮길 수 있는 Markdown.

[현재 인계 상태](docs/HANDOFF.md) · [검증 기록](docs/TEST_RESULTS.md) · [공식 자료](docs/OFFICIAL_SOURCES.md) · [토스 준비](docs/TOSS_READINESS.md)

## GPT 연결과 기본 안내 (2026-11-03)

서버는 DB에서 검색한 근거를 GPT에 전달하고 검증된 출처 ID와 짧은 생성 설명을 결과에 표시한다. 연결 시간 초과(기본 15초), 제공자 오류·응답 검증 실패·자료 부족·예산 제한에서는 문제 유형별 기본 안내를 저장하고 표시한다. 기본 안내는 AI 결과와 구분하며 비용 책임을 확정하거나 출처를 만들어내지 않는다. 인증·취소·DB 저장 오류와 전체 서버 연결 장애는 별도 오류 처리를 유지한다.

2026-11-03 사용자 제공 키를 `.local/ai.env`에서 확인하고 모델을 `gpt-6.1-sol`로 설정했다. `npm run dev:ai`로 내부 검증을 시작한다. 파일은 Git 제외 대상이며 키 값을 출력하지 않는다. 기존 `npm run dev:db`는 모의 AI를 유지한다. 로컬 API → PostgreSQL 근거 검색 → 실제 GPT-6.1 Sol → 검증된 결과 저장까지 1회 성공했다(약 7.1초, 근거 2건, 생성 설명 포함, 기본 안내 전환 없음). 운영 사이트 연결·배포는 아직 미완료다.

`AI_FALLBACK_ENABLED=false`로 서버 기본 안내 전환을 끌 수 있다. 기본 안내 결과는 `fallback.reason`으로 구분한다. 기존 mode 집계에서는 mock에 포함되며 실제 GPT 분석 건수로 계산하지 않는다. 실패한 요청의 과금은 확인되지 않으므로 0원으로 단정하지 않는다.
