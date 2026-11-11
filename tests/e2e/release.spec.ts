import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const example = {
  version: "1.4.0",
  days: 30,
  checkedAt: "2026-11-03T12:00:00Z",
  usage: [{ day: "2026-11-03", issue: "drain", mode: "live", count: 2 }],
  answers: [
    { issue: "drain", question: "observation", answer: "slow-drain", count: 2 },
  ],
  knowledge: [
    {
      id: "test-case",
      claim: "점검 결과와 계약 조건을 함께 확인해요.",
      content: "화면 검증을 위한 가상 자료입니다.",
      issues: ["drain"],
      source: {
        id: "test-source",
        version: "test",
        title: "법률 자료 예시",
        institution: "테스트",
        url: "https://www.law.go.kr/",
        location: "테스트",
        checkedAt: "2026-11-03",
        effectiveDate: null,
        technicalStatus: "verified",
        humanLegalReview: "pending",
        use: "internal",
        scope: "UI 테스트 자료",
        issues: ["drain"],
      },
    },
  ],
};
test("v1.4 home invites login and keeps collapsed status below main content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "memory",
        publicLaunch: true,
        retentionHours: 24,
        ready: true,
        blockers: [],
      },
    }),
  );
  let statusCalls = 0;
  await page.route("**/api/status", (r) => {
    statusCalls++;
    return r.fulfill({
      json: {
        version: "1.4.0",
        api: "connected",
        database: "connected",
        checkedAt: new Date().toISOString(),
        knowledge: { count: 7, version: "test" },
        ai: {
          mode: "mock",
          configured: false,
          lastSuccess: null,
          lastFailure: null,
        },
        login: { email: false, google: false, kakao: false },
        legalReview: "pending",
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "로그인해서 기록을 확인해 보세요" }),
  ).toBeVisible();
  await expect(page.locator(".mode-label")).toHaveText("v1.4");
  const status = page
    .locator(".app-footer")
    .getByRole("button", { name: "연결 상태 확인" });
  await expect(status).toHaveAttribute("aria-expanded", "false");
  expect(statusCalls).toBe(0);
  const main = await page.locator("#main").boundingBox();
  const footer = await page.locator(".app-footer").boundingBox();
  expect(footer!.y).toBeGreaterThanOrEqual(main!.y + main!.height);
  await page.screenshot({
    path: "docs/screenshots/v11-home-mobile.png",
    fullPage: true,
  });
  await status.click();
  await expect(page.getByText("v1.4.0", { exact: true })).toBeVisible();
  expect(statusCalls).toBe(1);
  await page
    .getByRole("button", { name: "로그인하고 기록 보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "로그인해서 기록을 확인해 보세요" }),
  ).toBeVisible();
});
test("public admin opens without login on mobile and has only read-only features", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let privateRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/admin/")) privateRequests++;
  });
  await page.route("**/api/public/dashboard", (r) =>
    r.fulfill({ json: example }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "방로그 사용 현황" }),
  ).toBeVisible();
  await expect(page.getByText("2건", { exact: true }).first()).toBeVisible();
  expect(privateRequests).toBe(0);
  await expect(page.getByLabel("관리자 비밀번호")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "회원 기록 삭제" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "선택 답변 통계", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "물이 천천히 내려가요", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "법률·판례 자료", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "법률 자료 예시" }),
  ).toBeVisible();
  await expect(page.getByText(/전문가 법률 검토: 대기/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/v11-public-admin-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "팀원 체험 안내", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "체험 시작하기" }),
  ).toHaveAttribute("href", "/");
  await page.route("**/api/admin/session", (r) =>
    r.fulfill({ status: 401, json: { message: "관리자 로그인 필요" } }),
  );
  await page.getByRole("link", { name: "운영자 로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "관리자 로그인" }),
  ).toBeVisible();
});
test("public admin failure is explicit and retry recovers without fake metrics", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/public/dashboard", (r) =>
    fail
      ? r.fulfill({ status: 503, json: {} })
      : r.fulfill({
          json: { ...example, usage: [], answers: [], knowledge: [] },
        }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText("불러오지 못했어요");
  fail = false;
  await page.getByRole("button", { name: "새로고침" }).click();
  await expect(page.getByText("0건", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
