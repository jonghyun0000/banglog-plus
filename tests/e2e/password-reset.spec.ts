import { test, expect } from "@playwright/test";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        ready: true,
        blockers: [],
        retentionHours: 24,
        publicLaunch: false,
        account: {
          enabled: true,
          signup: true,
          url: "https://example.supabase.co",
          publishableKey: "sb_publishable_test",
          google: false,
          kakao: false,
          retentionDays: 90,
        },
      },
    }),
  );
  await page.route("**/api/account/history", (r) => r.fulfill({ json: [] }));
});
test("password request uses existing account redirect and generic success (simulated)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://example.supabase.co/auth/v1/recover**", (r) => {
    expect(r.request().postDataJSON().email).toBe("test@example.com");
    expect(new URL(r.request().url()).searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:5173/?account=1",
    );
    return r.fulfill({ json: {} });
  });
  await page.goto("/?account=1");
  await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
  await page.getByLabel("가입 이메일").fill("test@example.com");
  await page.getByRole("button", { name: "재설정 메일 받기" }).click();
  await expect(page.getByRole("status")).toContainText("가입된 이메일이라면");
  await page.getByRole("button", { name: "로그인으로 돌아가기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
});
test("recovery callback validates confirmation and updates password (simulated)", async ({
  page,
}) => {
  let updates = 0;
  await page.route("https://example.supabase.co/auth/v1/user", (r) => {
    if (r.request().method() === "PUT") {
      updates++;
      expect(r.request().postDataJSON().password).toBe("changed-password-123");
    }
    return r.fulfill({ json: user });
  });
  await page.goto(
    "/?account=1#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery",
  );
  await expect(
    page.getByRole("heading", { name: "새 비밀번호 설정" }),
  ).toBeVisible();
  await page
    .getByLabel("새 비밀번호", { exact: true })
    .fill("changed-password-123");
  await page.getByLabel("새 비밀번호 확인").fill("different-password");
  await page.getByRole("button", { name: "비밀번호 변경하기" }).click();
  await expect(page.getByRole("alert")).toContainText("일치하지 않아요");
  expect(updates).toBe(0);
  await page.getByLabel("새 비밀번호 확인").fill("changed-password-123");
  await page.getByRole("button", { name: "비밀번호 변경하기" }).click();
  await expect(page.getByRole("status")).toContainText("비밀번호를 변경했어요");
  expect(updates).toBe(1);
});
test("mail failure is shown without claiming delivery (simulated)", async ({
  page,
}) => {
  await page.route("https://example.supabase.co/auth/v1/recover**", (r) =>
    r.fulfill({ status: 429, json: { msg: "rate limited" } }),
  );
  await page.goto("/?account=1");
  await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
  await page.getByLabel("가입 이메일").fill("test@example.com");
  await page.getByRole("button", { name: "재설정 메일 받기" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "메일 요청을 처리하지 못했어요",
  );
});

test("PKCE email callback opens recovery form and expired exchange never updates password (simulated)", async ({
  page,
}) => {
  await page.route("https://example.supabase.co/auth/v1/recover**", (r) =>
    r.fulfill({ json: {} }),
  );
  await page.goto("/?account=1");
  await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
  await page.getByLabel("가입 이메일").fill("test@example.com");
  await page.getByRole("button", { name: "재설정 메일 받기" }).click();
  await expect(page.getByRole("status")).toContainText("가입된 이메일이라면");
  await page.route("https://example.supabase.co/auth/v1/token**", (r) => {
    expect(r.request().postDataJSON().code_verifier).toBeTruthy();
    return r.fulfill({
      json: {
        access_token: "pkce-test-token",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
    });
  });
  await page.goto("/?account=1&code=test-code");
  await expect(
    page.getByRole("heading", { name: "새 비밀번호 설정" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.route("https://example.supabase.co/auth/v1/token**", (r) =>
    r.fulfill({
      status: 400,
      json: { error: "invalid_grant", error_description: "expired" },
    }),
  );
  await page.goto("/?account=1&code=expired-code");
  await expect(
    page.getByRole("heading", { name: "새 비밀번호 설정" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }),
  ).toBeVisible();
});
