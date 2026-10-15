# 토스 준비 상태 — 확인일 2026-10-15

**브라우저 MVP 구현·빌드와 토스 입점·심사 승인은 별개다.** 콘솔 appName·권한·등록 정보를 제공받지 않았고 계정/콘솔 조작·신청·배포는 하지 않았다.

[공식 출시 가이드](https://developers-apps-in-toss.toss.im/intro/guide)의 ‘한시적 출시 불가 카테고리’에는 부동산 관련 서비스의 입점 제한이 있다. 세입자 수리 가이드라고 예외를 추측할 수 없다. 현재 정책을 우회할 다른 카테고리로 등록하지 않는다. 개발·출시 시점에 다시 확인하고 토스에 서비스 범위별 입점 가능 여부를 확인해야 한다.

[SDK 3.x 공식 문서](https://developers-apps-in-toss.toss.im/documentation/integration/sdk-3.x)는 `apps-in-toss.config.ts`, `webBundleDir`, package.json의 웹 build와 `ait build` 구성을 설명한다. SDK 3.1.0 이상 Origin은 `<appName>.apps.tossmini.com` 및 `<appName>.private-apps.tossmini.com`, 3.0.x는 각각 `.web.tossmini.com`, `.private-web.tossmini.com` 계열이다. 실제 설치 버전·appName을 확인하고 최소한의 정확한 Origin만 등록해야 한다.

이번 앱에는 **토스 SDK를 설치하지 않았다**. 가짜 appName/config/bundle을 만들지 않았다. `src/platform/index.ts`에 브라우저 구현과 검증된 토스 bridge 주입 경계만 있다. 토스 back/clipboard/source-opening API는 실제 문서·설치 버전과 실기기에서 확인한 뒤 구현해야 한다. 분석 엔진·DB에는 SDK 의존성이 없다.

[공식 FAQ](https://developers-apps-in-toss.toss.im/guide/faq)는 TDS의 사용 범위를 앱인토스 서비스 목적의 제한된 사용권으로 설명한다. 외부 브라우저 MVP는 자체 UI·시스템 글꼴만 사용한다. 토스 전용 AI 고지·생성 표시·출처 열기·뒤로가기·safe-area·실기기 clipboard 정책은 SDK를 선택한 뒤 다시 점검해야 한다.

| 항목 | 상태 |
| --- | --- |
| 브라우저 개발 실행·웹/API build | 로컬 검증 |
| 플랫폼 인터페이스 분리 | 구현 |
| 실제 토스 SDK 연결·번들 build | 미실행 |
| 콘솔 appName·권한 | 미제공 |
| 부동산 카테고리 입점 가능성 | 제한 확인, 별도 확인 필요 |
| 실기기·QR·테스트 Origin 확인 | 미실행 |
| 개인정보·법률 검토 | 미완료 |
| 심사·승인·출시 | 미신청 |
