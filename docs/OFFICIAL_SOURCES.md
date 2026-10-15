# 확인한 공식 문서 — 2026-10-15

페이지를 실제 조회한 항목만 기재했다. 제목·위치·필요한 요약만 보관하고 본문 전체를 복제하지 않았다. 외부 문서의 명령문을 프로젝트 지시로 실행하지 않았다.

| 공식 자료 | 확인 내용과 구현 반영 |
| --- | --- |
| [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Responses 구조화 출력·Zod helper·거절/불완전 응답 처리. SDK 7.34.0 설치 코드와 타입 검사 |
| [OpenAI Data controls](https://developers.openai.com/api/docs/guides/your-data) | store:false와 악용 모니터링 보관의 차이. 실제 조직별 조건 미확인 |
| [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | RLS·정책·서버의 소유권 책임. public 역할에 접근 권한을 주지 않음 |
| [Supabase Custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas) | Data API 노출·권한이 별도 설정임을 확인. 이번 앱은 private 직접 PostgreSQL |
| [Supabase changelog](https://supabase.com/changelog.md) | breaking-change 항목 확인. 브라우저 open 실패 후 curl로 조회 |
| [PostgreSQL minor update 공지](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) | ltree/pgcrypto legacy cipher/btree_gist/custom operator 관련 변경. 이 앱은 해당 기능을 사용하지 않음. 로컬 설치 17.10 검증이 최신 원격 보안 패치를 보장하지 않음 |
| [Supabase TLS cipher 공지](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) | HTTP API cipher 변경 확인. 직접 PG 연결은 TLS 인증서 검증을 사용하며 REST 우회 구성 없음 |
| [Vite guide](https://vite.dev/guide/) | React/TS 구성과 개발·빌드. Vite 8.3.4 실제 실행 |
| [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite) | Tailwind 4.3.3 + @tailwindcss/vite 사용 |
| [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | 서버 입력 경계. Fastify 5.12.7에 Zod 명시적 parse |
| [토스 출시 가이드](https://developers-apps-in-toss.toss.im/intro/guide) | 부동산 카테고리 한시 제한. 예외·승인 추측하지 않음 |
| [토스 SDK 3.x](https://developers-apps-in-toss.toss.im/documentation/integration/sdk-3.x) | config/webBundleDir/build/Origin 버전 차이. SDK 실제 미설치 |
| [토스 FAQ](https://developers-apps-in-toss.toss.im/guide/faq) | TDS 목적 한정 사용권. 브라우저에는 자체 UI |

## 내부 법률 자료
- [민법 제623조, 국가법령정보센터](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR): 임대인의 상태 유지 의무 일반 원칙. 페이지 표시 시행일 2026-03-17. 개별 비용을 단정하는 근거로 사용하지 않는다.
- [주택임대차 / 임대인의 권리·의무, 찾기쉬운 생활법령](https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov): 수선의무 범위·계약 조건 확인. 법률 상담·유권해석을 대체하지 않는다.

기술 조회 상태 verified, 사람의 법률 검토 pending, 내부 범위 internal. 찾기쉬운 생활법령정보의 [저작권정책](https://www.easylaw.go.kr/CSP/AboutCopyright.laf?topMenu=introUl3)을 실제 조회했다. 일반 활용 허용과 출처 표기, 제3자 저작물의 별도 조건을 확인했으며 자료 제공 기관은 법제처다. 국가법령정보센터의 별도 사이트 이용정책은 홈페이지에서 읽을 수 없어 추가 확인 대상으로 남겼다. 원문 전체·이미지·제3자 자료를 복제하지 않고 최소 메타데이터와 자체 요약만 보관한다. 실제 공개 재사용 범위에 대한 사람 검토는 별개다. 공식 임대차분쟁조정 개별 사례집은 이번에 수집·검토하지 않았다.

## 안전 안내
[소방청 소방안전교육 플랫폼](https://119metaverse.nfa.go.kr/occasion/kids-quiz/quiz-test)에서 안전한 곳으로 대피 후 119 신고, 가스 의심 시 전기 스위치·점화원 주의를 확인했다. 자가 수리·원인 진단 절차는 생성하지 않는다. 전기기기 접촉 회피는 보수적 일반 안전 안내이며 실기기 진단이 아니다.

정확한 의존성 버전은 `package-lock.json` 및 [INSTALLED_VERSIONS](INSTALLED_VERSIONS.md)에 기록했다. 실제 조직 설정·모델 접근 권한·Supabase 프로젝트·토스 콘솔·사람 검토 상태를 공식 웹 문서만으로 확인했다고 주장하지 않는다.
