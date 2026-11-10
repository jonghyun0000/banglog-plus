# 방로그 Plus — Claude Code 인수인계

작성: 2026-11-10 (한국 시간). 이 문서는 현재 로컬 코드 확인, 11/09 운영 DB 읽기 점검, 기존 배포·검증 기록을 구분하여 정리했다. 오늘 새 배포·DB 변경·GPT 호출·전체 테스트는 하지 않았다.

## 1. 먼저 알아야 할 것

- 프로젝트: `/Users/jonghyun/Desktop/방로그 puls` (plus가 아니라 **puls**). 한글 파일명은 macOS에서 분해형으로 표시될 수 있다.
- 대한민국 주택 세입자를 위한 수리 상황 정리 → 안전한 다음 행동 → 연락 문구 → 선택 기록 저장 서비스.
- 현재 package.json 버전 **1.3.0**. React/Vite/TypeScript + Fastify + PostgreSQL(Supabase) + OpenAI.
- 서비스: https://banglog-plus.vercel.app/
- 공개 집계 관리자: https://banglog-plus.vercel.app/admin
- 인증 필요한 운영 관리: https://banglog-plus.vercel.app/admin?manage=1
- 비공개 GitHub: https://github.com/jonghyun0000/banglog-plus
- 별도 방로그 서비스: https://banglog-puce.vercel.app/ . Plus와 화면 이동만 연결했으며 로그인·방 기록 자동 공유는 구현하지 않았다.
- 별도 방로그 Desktop 소스는 배포본보다 오래되었다는 기록이 있다. 두 프로젝트를 혼동하거나 덮어쓰지 않는다.

**가장 큰 미해결 문제:** 11/09 실제 DB 기준 고유 근거 7개, 공개 답변 조건에 적격인 근거 0개. 모델 설정과 DB 연결이 되어 있다는 사실이 실제 GPT 근거 답변 생성·법률 정확도 검증을 뜻하지 않는다.

## 2. 작업 시작 순서

1. `AGENTS.md`와 이 문서를 먼저 읽는다.
2. `git status --short`로 기존 작업 확인. 수정·미추적 파일이 매우 많다. reset/clean/일괄 덮어쓰기·무차별 git add 금지. 미추적 `data/`, `api/`, 여러 기능 파일도 실제 작업이다.
3. 요청 범위의 코드·테스트·관련 검증 문서를 읽는다. README는 초기 기록이 많이 남아 있어 날짜와 현재 코드 확인이 필요하다.
4. 로컬에서 변경·적절한 검사 → 실제 결과 기록. 배포·원격 DB 변경은 사용자 요청의 승인 범위를 확인한다.
5. 사용자 선호에 따라 노션에도 변경 이유·PRD 영향·검증·배포 여부를 갱신한다. 접근 불가면 로컬에 기록하고 미반영 사실을 알린다.

## 3. 실행 환경과 명령

Node **22.12 이상, 23 미만**. npm lockfile 유지.

```sh
cd '/Users/jonghyun/Desktop/방로그 puls'
npm ci
npm run dev
```

기본 설정은 mock AI + memory 저장소. 실제 환경변수가 있으면 모드가 달라지므로 `server/config.ts` 확인. 웹 `http://127.0.0.1:5173`, API `http://127.0.0.1:8787`; Vite가 /api를 프록시한다.

```sh
# 로컬 PostgreSQL: initdb/pg_ctl 필요, 운영 DB와 분리
npm run db:local
npm run dev:db
npm run db:stop
```

로컬 DB는 127.0.0.1:54329, `.local/postgres/`, 접속 설정 `.local/database.env`. `dev:ai`는 `.local/database.env` + `.local/ai.env`를 읽어 실제 유료 호출 가능한 내부 모드로 실행한다. 단순 UI 확인용으로 무심코 실행하지 않는다. `knowledge:setup`, `members:setup` 등 쓰기 스크립트는 먼저 연결 대상과 코드를 확인한다.

```sh
npm run typecheck
npm run lint
npm test
npm run db:test
npm run test:e2e
npm run build
```

E2E는 자체 서버를 띄우므로 포트 충돌 확인. 최초 Chromium 설치가 필요할 수 있다. db:test는 격리 PostgreSQL 검사. evaluate는 규칙 일관성 검사를 법률 정확도와 혼동하지 않는다. 실모델 실험에는 별도 비용·호출 상한이 필요하다.

## 4. 코드 지도

| 위치 | 역할 |
| --- | --- |
| src/app/App.tsx, api.ts | 화면 흐름·API 통신 |
| src/features/intake/Start.tsx | 첫 화면·문제 선택 |
| src/features/questions/Questions.tsx, Review.tsx | 질문 분기·선택·최종 검토 |
| src/features/questions/BuildingLookup.tsx | 선택 주소·건물 조회·추가 질문 |
| src/features/analysis/Result.tsx | 결과·비용 방향·근거·기본 안내 표시 |
| src/features/analysis/DrainGuide.tsx, BuildingGuide.tsx | 배수·건물 상황 안내 |
| src/features/analysis/NextResponse.tsx | 다음 대응·상황별 해설·근거 표시 |
| src/features/message/DraftEditor.tsx, personalize.ts | 문구 수정·선택 이름/호수·미리보기·복사 |
| src/features/account/, admin/, status/ | 계정 기록·관리자·연결 상태 |
| shared/schema.ts, questions.ts | 입력·응답 스키마·문항 |
| shared/analysis.ts, drain.ts, building.ts, safety.ts | 결정 규칙·안전·담당자·수리 이력 |
| shared/fallback.ts | 근거 부족/AI 장애 기본 안내; GPT 결과와 구별 |
| server/routes/app.ts | Fastify API·인증·분석·기록·피드백 |
| server/ai/provider.ts | OpenAI 구조화 응답·인용·안전 검사 |
| server/sources/retrieval.ts, dataset.ts | DB 검색·자료 버전 선택 |
| server/repositories/postgres.ts, history.ts | 서버 DB 접속·저장·회원 기록 |
| server/auth/, admin/, operations.ts | 인증·관리 권한·운영 상태 |
| server/building.ts, config.ts | 건축물 API·환경설정 |
| api/index.ts, vercel.json | Vercel API 진입점·rewrite·cron |
| data/repair-knowledge.v2.json | 현재 자료 버전 정의·요약 근거 |
| supabase/migrations/ | 스키마·정책·출처·회원·승인 관리 이력 |
| tests/, docs/ | 단위/API/E2E·시점별 검증 기록 |

주요 API: `/api/config`, `/api/status`, POST `/api/buildings`, POST `/api/sessions`, DELETE `/api/session`, POST `/api/analyses`, GET `/api/analyses/:id`, POST `/api/analyses/cancel`, 결과별 `/feedback`, `/events`, GET/POST `/api/account/history`, DELETE `/api/account/history/:id`.

## 5. DB 연결과 데이터 경계

Supabase 프로젝트 **HYUNDO Master**, ref `bwsmdazxwvvowagkvcgw`, Plus 전용 스키마 **banglog_plus**. 다른 서비스와 프로젝트·Auth를 공유한다. 기존 banglog/public/다른 서비스 테이블과 전역 Auth 설정을 임의 변경하지 않는다.

서버는 `DATABASE_URL`로 pg 직접 접속, 원격 TLS 요구. 브라우저는 서버 API 및 Supabase Auth를 사용한다. RLS·소유권·서버 입력 검사를 우회하지 않는다. 사용자 metadata를 관리자 권한 근거로 사용하지 않는다.

24개 테이블(마이그레이션 기준):

| 그룹 | 테이블 |
| --- | --- |
| 세션·상황 | guest_sessions, analysis_sessions, case_facts, question_answers |
| 결과·출처 | analysis_results, result_sources, legal_sources, legal_source_versions, knowledge_chunks |
| 기록·회원 | member_history, members |
| 피드백·집계 | feedback_events, usage_metrics, usage_daily_summary, answer_daily_summary |
| 운영 | budget_ledger, admin_sessions, admin_audit, rate_limits, analysis_leases, operational_events |
| 자료 승인 | dataset_registry, evidence_candidates, source_permissions |

핵심 마이그레이션: 초기 20261015115914, 자료 20261103045320, 회원 20261103062040, 운영 20261103065841, 자료 승인 20261105071238. 기존 운영 반영 여부와 로컬 이력을 확인한 뒤 작업하며 전체 초기화를 실행하지 않는다.

- 비회원 임시 기록 24시간; 회원은 명시적 저장, 최대 90일·100개 정책. 실제 정리 동작은 별도 확인 필요.
- 이메일/비밀번호 가입·로그인·비밀번호 확인. Google/Kakao 현재 비활성. 이메일 확인 설정은 사용자가 공유 프로젝트에서 변경한 이력이 있으므로 최신 대시보드 확인 필요.
- 공개 관리자에는 집계 정보만. 원문·개인 기록·회원 관리 작업은 운영 인증 경로에 한정.
- 이름·호수 선택 입력은 최종 문구 복사용 화면 상태이며 GPT/저장 본문에 보내지 않는 설계.
- 건물 주소·동호수와 선택된 용도/구조/사용승인일/층수 등 분석용 정보를 구분한다. 건물 연도로 설비 노후나 책임을 확정하지 않는다.

## 6. 비밀값 없이 설정 확인하기

**키·비밀번호·DB 접속 문자열·세션 토큰을 문서/로그/채팅/Git에 출력하지 않는다.** 실제 키는 기존 로컬 비공개 파일 또는 Vercel 환경변수에서만 사용한다. `.env.example`과 config.ts는 이름·형식 참고용.

| 변수 | 용도 |
| --- | --- |
| DATABASE_URL, DATABASE_SSL, REPOSITORY | DB 연결·TLS·memory/database |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | Auth 공개 설정 |
| OPENAI_API_KEY, OPENAI_MODEL, AI_MODE | 서버 전용 AI 설정; 현재 확인 모델 gpt-6.1-sol |
| PUBLIC_LAUNCH_ENABLED, INTERNAL_LIVE_ENABLED, PROVIDER_RETENTION_ACK | 공개/내부 실행 및 보관 확인 조건 |
| AI_FALLBACK_ENABLED, OPENAI_TIMEOUT_MS | 기본 안내 전환·시간 제한 |
| MAX_DAILY_CALLS, MAX_DAILY_TOKENS, MAX_CONCURRENT, MAX_OUTPUT_TOKENS | 사용량 제한 |
| INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION, DAILY_BUDGET_USD | 비용 제한, 현재 가격은 별도 확인 |
| BUILDING_API_KEY | 공공 건축물대장 API |
| MEMBER_SIGNUP_ENABLED, MEMBER_HISTORY_ENABLED | 가입·기록 기능 |
| GOOGLE_LOGIN_ENABLED, KAKAO_LOGIN_ENABLED | 현재 비활성 |
| PUBLIC_TEAM_DASHBOARD, ADMIN_PASSWORD_HASH, CRON_SECRET | 공개 집계·관리 인증·정리 작업 |

`.local/ai.env`, `.local/database.env`는 기존 코드에서 사용하는 경로이며 파일 존재·유효성은 별도 확인. 어떤 .env든 통째로 읽어 출력하지 않는다. 서버 키를 VITE_ 변수에 넣지 않는다.

## 7. GPT가 근거를 거치는 실제 구조와 한계

사용자 입력 → 서버 검증·위험 판단 → PostgreSQL 근거 검색 → 검색 문단·출처 버전을 GPT에 전달 → 구조·인용·안전 검사 → 결과 저장/표시. 위험 차단, 취소, 저장 오류는 기본 안내로 숨기지 않는다.

현재 retrieval.ts는 유형 필터, 증상 일치·키워드 정렬, 최대 4개 문단 검색. 임베딩/벡터 검색/파인튜닝은 구현했다고 표현하지 않는다. 현재 검색 순위에 배수 위치·범위·약품·기시도 조치·수리 이력이 명시적으로 반영되지 않는 것이 주요 개선점이다.

판례의 공개 검색에는 technical_status=verified, human_legal_review=approved, use_scope=public 및 해당 출처 버전의 유효한 external_llm_allowed 승인(만료·철회 검사)이 필요하다. 2026-11-10부터 공식 조문 3개는 별도 use_scope=general / human_legal_review=pending으로 일반 안내만 허용한다. server/sources/official.ts의 검증 manifest 정확 일치와 유효한 source_permissions가 모두 필수이며, 전문가 승인으로 바꾸지 않는다. `PUBLIC_LAUNCH_ENABLED=false` 등으로 승인 검사를 우회해 운영 답변을 늘리지 않는다.

### 2026-11-09 운영 읽기 점검 수치

- 고유 출처 7: 법조문 1, 공식 안내 1, 판결 5.
- 현재 repair-kb-2026-11-03.v2 조각 7. v1 포함 총 조각 11; 고유 출처 11개가 아니다.
- 출처 버전 11 모두 technical verified / 법률 검토 pending / internal.
- source_permissions 0, 공개 조건 적격 조각 0.
- dataset_registry 7, evidence_candidates 12(소비자 안내 10·FAQ 2), 모두 검토 대기. 판례 12개로 표현하지 않는다.
- /api/status: v1.3.0, API·DB connected, live 설정, legalReview pending. live는 이번 답변의 실모델 성공 증거가 아니다.

자료 부족은 KNOWLEDGE_NOT_FOUND 등으로 기본 안내 전환; sources·citedClaims는 비우고 책임 undetermined. 화면에 GPT 결과가 아님을 밝힌다. ‘연결됨’과 ‘자료 사용 가능’과 ‘실제 생성 성공’을 따로 확인해야 한다.

## 8. 지금까지 반영된 내용

- 10/15: 아이디어·개발 프롬프트·MVP·GitHub/Vercel (사용자 회고·기존 기록).
- 10/20–21: 벽지/장판·배수·옵션 포함 6종 확장, 팀 피드백·사례 조사.
- 10/22 Zoom은 예정 기록만 확인. 실제 발언·결정 생성 금지. 10/27–11/02 기록 공백도 임의 보완 금지.
- 11/03: Plus DB·GPT 경로·회원 기록·관리자·배수 분기·v1.1.
- 11/04: 학회·차별성·공공데이터 연구 방향 논의.
- 11/05 v1.2–1.3: 오선택 수정·직접 입력·위험 차단·상단 축소·버튼 통일·위험 안내 하단 배치, 선택 건물 조회·수리 이력·관리 담당자 안내, 요청 문구 개선, 근거 승인 관리, 이름/호수 선택·미리보기·복사, 파일럿 준비.
- 11/09: 방로그 ↔ Plus 이동 연결. Plus 배포 ID dpl_EoE929gEtEXes1YhzxRZFkNkwwr5 (docs/NAVIGATION_LINKS_20261109.md).
- 11/09–10: 근거 수·검색 한계 점검, 노션 날짜별 고민·결정·주차별 계획 정리. 기능 개선/신규 승인 완료가 아니다.

## 9. 앞으로의 우선순위 — 미구현·미검증과 구분

### P0 근거 확보·적용성 검토

기존 출처 7 + 후보 12의 적용 조건·예외·이용 허용·원문 일치를 점검. 배수·누수·벽지/장판 6개 사례부터 빈 부분을 채운다. 팀 원문 교차 확인과 적격 법률 검토는 다르다. 교수님에게 법률 전문 검토를 임의 배정하지 않는다. 승인자를 지어내지 않는다.

AI Hub 원본 및 이용조건 미확인 자료는 **로컬만** 유지. 운영 DB/GPT 전송 금지. 기존 779건 등 후보 수를 검증 완료로 취급하지 않는다. 로컬 원자료: `/Users/jonghyun/Desktop/방로그 자료들/` 내 민사법 LLM·계약 문서 데이터.

### P1 검색·결과 개선

- 이미 수집한 상황정보를 검색 입력·관련성 판정에 연결하고, 동일 자료·사례로 개선 전후 비교.
- 결과에 상황 요약 → 지금 할 일 → 실패 시 대응 → 담당자 → 필요 증거 → 적용 법률·판례와 한계를 자연스럽게 연결.
- ‘검증 자료 기반 AI 해설’ 제안 상태. 실제 검토 없는 변호사/공인중개사 코멘트·직함·인증을 만들지 않는다.
- 사용자는 과실비율 시각화를 제안했으나, 근거 없는 70:30 대신 임대인 검토 근거·임차인 검토 근거·추가 확인 사항을 보여주도록 권고했다. **최종 구현 승인이 확정된 요구로 간주하지 말 것.**
- 원인 불명은 필요한 추가 질문으로 연결. 청소 실패=배관 결함, 건물 연도=노후, 곰팡이=환기 과실로 단정하지 않는다.

### P1 평가·파일럿

`data/research/2026-11-05/evaluation-12.json`: 6분야×2 가상 사례. A 일반 모델/B 유형 검색/C 상황정보 반영 검색. 같은 입력·모델·자료 버전 유지, 질문 수집 효과는 따로 평가. 검색 Recall@4/Precision@4와 주장 근거·안전·행동 구체성·유보율·비용을 구분. 법률 기준답 검토와 실험은 미완료. 12개로 전체 정확도 일반화 금지.

파일럿 5–10명 제안: 목적 이해·수정·다음 행동 설명·복사·저장 관찰. 80%는 목표이지 측정 성과가 아니다. 개인정보 최소화·동의와 필요한 연구 윤리 절차 확인.

## 10. 검증 상태·배포 주의

- 11/05 기록: 단위/API 169, 브라우저 38, DB·타입·린트·빌드 통과. 일부 인증은 모의 인증이므로 실계정 가입 전 과정 검증과 다르다.
- 11/09 기록: Plus 단위 169, lint/typecheck/build, 운영 320/390/1440px 왕복 이동·가로 넘침·아이콘 확인. 로그인된 방 접근은 재검증 안 함.
- 오늘 문서 작성에서는 위 테스트를 다시 실행하지 않았다. 현재 파일에 대한 테스트는 다음 변경 시 실행한다.
- 참고: docs/pilot/, docs/*verification.json, tests/e2e/. 시점과 검증 범위를 확인할 것.
- Vercel 현재 빌드 `npm run build`, dist, api/index.ts 서버 함수, /api rewrite. README의 ‘정적 데모만·서버 미배포·공개 차단’은 과거 설명이다.
- Vercel cron `/api/cron/cleanup` 0 19 * * * (UTC). 삭제 정책·운영 실행 상태 확인 후 변경.
- 자동 배포 연동 상태는 확인 후 push. 사용자 승인 범위 없이 운영 배포·DB 스키마/권한 변경하지 않는다.
- 서비스 로고·favicon·불투명 Apple Touch Icon 180×180·manifest PNG192/512 유지. 배포 시 연결·이미지 응답·maskable 여백 검증.

## 11. 문서·노션

공식 홈: https://app.notion.com/p/40f37d5b27a880beb5fcd13471b0514f
원본 활동 기록: https://app.notion.com/p/AI-DB-3-3fabe8f0b9ed80f19d53c284e7150d6d (보존)
PRD: https://app.notion.com/p/40f37d5b27a8818086c6d8aa61f5545d
연구·파일럿: https://app.notion.com/p/40f37d5b27a881508711e0127b9c4d7e
11/12 보고 준비: https://app.notion.com/p/41337d5b27a881caba50c8f920753113

노션 홈은 서비스 → 기획 비교 → 날짜별 활동/고민/결과 → 주차별 연구계획 순서. 교수님 미팅 안내를 상단에 다시 올리지 말라는 사용자 선호. 상세 자료는 하위 페이지/접기. 계획·실측·미검증을 구분하고 기존 페이지 보존.

목요일 수업 후 시간이 맞으면 한수미 교수님께 짧게 보고 예정. 정해진 시각·실제 참석·합의 내용을 만들지 않는다. 11/12 준비, 이후 근거 검토→검색 실험→12사례 답변→파일럿→발표는 제안 일정.

추가 로컬 자료: docs/ACCOUNTS_AND_DATA.md, KNOWLEDGE_PIPELINE.md, DRAIN_ADAPTIVE_REVIEW.md, TAILORED_RESPONSE_REVIEW.md, NAVIGATION_LINKS_20261109.md, docs/research/, docs/pilot/. 옛 문서와 충돌하면 날짜·코드·실제 설정을 확인한다.

## 12. Claude에게 바로 줄 시작 요청

> AGENTS.md와 HANDOFF_CLAUDE.md를 읽고 기존 미커밋 작업을 보존해 주세요. 먼저 공개 답변 근거 부족과 현재 검색의 상황정보 반영 범위를 확인하고, 기존 12개 사례 중 배수·누수·벽지/장판 6개에 대한 근거 대응표와 개선 전후 비교 계획을 로컬에서 준비해 주세요. 이용조건 미확인 자료를 운영 DB/GPT로 보내거나 승인 플래그를 우회하지 마세요. 구현·테스트·실제 법률 검토를 구분하고, 운영 반영 전 변경 내용을 보여 주세요.

## 후속 변경: 비밀번호 찾기 (2026-11-10)
Account.tsx + PasswordReset.tsx에 이메일 재설정 요청과 PASSWORD_RECOVERY → 새 비밀번호 두 번 입력 → updateUser 흐름 추가. tests/e2e/password-reset.spec.ts 추가. 상세는 docs/PASSWORD_RESET.md.
**미배포·검증 미완료:** node_modules 일부 파일이 macOS dataless 상태로 읽기에서 대기하여 타입/린트가 정체되고 E2E 개발 서버가 시간 초과했다. 의존성 파일 복원 후 전체 검사 필요. 실제 SMTP 수신·운영 복귀·변경 후 로그인도 미검증. 기존 비밀키·원격 DB·공유 Auth 설정 변경 없음.

### 의존성 복구와 비밀번호 재설정 검증 후속
2026-11-10: 의존성을 ~/.cache/banglog-plus-deps-20261110/node_modules에 lockfile 기준 오프라인 재설치 후 프로젝트 node_modules에서 연결했다. 이전 dataless 파일은 node_modules.offloaded-backup에 보존, 읽거나 배포하지 않는다. 초기 복구 이벤트 경합·hash/popstate 홈 이동 오류를 수정했고, 타입·린트·169 단위·격리 DB·빌드·42 브라우저 검사 통과. 자세한 운영 배포/실계정 결과는 docs/PASSWORD_RESET.md의 최신 기록을 확인한다.

### 비밀번호 찾기 실계정 확인 완료
2026-11-10 사용자 직접 확인: 실제 메일 수신·비밀번호 변경·새 비밀번호 재로그인 완료. 운영 배포 dpl_FjCw5s5KNpSJhxdEmHYkSSEGUNkP. 모의 Auth 브라우저 검사와 실제 사용자 확인을 구분하며, 이전 확인 대기 상태는 해소되었다. 비밀번호·메일 인증 링크는 보관하지 않는다.

## 최신 운영 방향: Plus 단독 서비스 (2026-11-10)
사용자 결정: 메인은 방로그 Plus 단독 운영이다. Plus의 ‘내 방 기록으로 돌아가기’ 링크(상단/질문 하단)와 두 서비스 연결 안내를 제거했다. 과거 연결 기록은 당시 상태로만 참고한다. 기존 계정·기록 저장·비밀번호 재설정 기능은 유지한다. 별도 방로그 프로젝트의 링크나 인증 구조를 이 요청만으로 변경하지 않는다.
방향 재확인: 기존 방로그 → 방로그 Plus 유입 링크는 유지한다. 제거 대상은 Plus → 방로그 복귀 링크뿐이다.

## 2026-11-10 체크박스 UI 수정 (로컬, 미배포)
- src/styles/tokens.css: account-login의 일반 label/input 규칙에서 .checkbox와 type=checkbox를 제외.
- 재현: 모바일 390px 가입 동의 체크박스 300×48px, grid 아래로 설명 밀림. 수정 후 22×22px, flex 옆 정렬.
- 검증: 선택/해제·가로 넘침 없음, typecheck/lint/169 unit/DB/42 E2E/build 모두 통과. Auth E2E는 모의 검사.
- 스크린샷: docs/screenshots/checkbox-signup-mobile.png. 기존 기록·회원 로직 변경 없음. 운영 배포 안 함.
- 노션 날짜별 활동 기록에도 미배포 상태로 기록.

## 2026-11-10 양측 책임 결과 UI (로컬·미배포)
- Responsibility.tsx 추가, Result 비용 카드를 양측 비교로 변경. 기존 조건·불확실성·상충 진술 유지.
- 실제 비율 산정 근거가 없어 양측 미산정으로 표시. 방향을 퍼센트로 변환하지 않음. 위험/범위 밖 숨김.
- 타입·린트·175 단위·29 DB·42 E2E·빌드 통과. 결과 JSON/DB/기록 로직 변경 없음.
- docs/RESPONSIBILITY_UI_20261110.md 참조. 노션 홈·PRD·활동 기록 갱신.

## 2026-11-10 선택 사진 분석 운영 배포
- dpl_4WpoTXkjghjaUDoMpwoRf3nfRRQa promote 완료, banglog-plus.vercel.app / v1.3.0.
- docs/PHOTO_ANALYSIS_20261110.md 및 docs/photo-production-verification.json 참조.
- shared/photo.ts enum 기반 관찰, server/ai/photo.ts 기존 모델 사진 입력, 선택 사진 → 기존 DB 검색/생성 흐름 반영. 미승인 근거 차단 그대로 유지.
- 기존 체크박스 UI·양측 책임 결과 UI도 이번 배포에 포함. 위 미배포 기록은 과거 상태.
- 실제 이미지 API 정상 응답(합성 이미지 unclear), DB 관찰 결과 저장·원본 미저장·테스트세션삭제 확인. 법률 안내는 근거 부족 기본 안내. 실하자 사진 정확도 검증 아님.
- 단위181/브라우저43/격리DB29/타입/린트/빌드 통과, 모바일 운영 UI/아이콘 확인. DB 마이그레이션 없음.

## 2026-11-10 후속 · 기본 안내 반복 원인 해결

- 문서: docs/OFFICIAL_GUIDANCE_20261110.md. 기존 판례/AI Hub는 승인하지 않고 민법 623·634·626(1) 원문을 공식 사이트와 대조해 별도 일반 안내 tier 추가.
- data/official-statutes.v1.json/sql: 원문·해시·대조/이용 근거·범위. 운영 DB에 적용한 official_general_scope migration은 기존 public 승인 제약·RLS를 유지하고 general 구분만 추가.
- 기존 7개 source가 9개 고유 source로, 버전 11→14, 활성 검색조각7+3. 전문가 승인0, 일반 조문3. 이용 허용은 2027-02-10 UTC 만료 전 재검토.
- Postgres 검색에서 두 dataset 조회하되 새 조문은 immutable manifest와 정확 일치 필수. 로컬 내용을 DB 조회 실패시 대체하여 GPT에 보내지 않는다.
- 사진 징후·해본 조치·선택 상황을 기존 생성 입력에 포함. 모델 생성의 factKeys/claimIds는 실제 요청의 enum으로 제한. 존재하지 않는 답변 참조 때문에 기본 안내가 나오던 문제를 예방.
- 코드/DB 검사와 실제 API 호출은 구분. 실호출 기록은 docs/official-guidance-live-verification.json. 초기 후보의 실패도 first-check JSON에 보존. 일반 안내가 개별 사건 법률가 승인이나 사진 진단 정확도 검증을 뜻하지 않음.
- 최종 배포 dpl_3Emxc8Zt6C6Ugpk3YnPWtHbQWaNu 운영 promote 완료. 사진 포함 배수·역류/약품·벽지비용 합성3건 모두 실제 GPT 생성/인용/DB 저장 성공, 기본 안내 전환 없음. 단위193/브라우저43/격리DB30 통과. 노션4페이지 갱신. AIHub나 개별 판례의 전문가 승인 완료로 오해하지 말 것.
