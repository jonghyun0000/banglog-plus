import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { defaultIntake } from "../../shared/schema";
import { makeAnalysis } from "../../server/domain/analysis";
const userId = "11111111-1111-4111-8111-111111111111";
const account = {
  enabled: true,
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test",
  google: true,
  kakao: true,
  retentionDays: 90,
};
test("account remains optional when remote login is not configured", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "로그인 · 내 기록", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "현도컴퍼니 계정으로 로그인" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click();
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await expect(
    page.getByRole("heading", { name: "어떤 문제가 생겼나요?" }),
  ).toBeVisible();
});
test("email login uses the shared membership endpoint and handles invalid credentials (simulated)", async ({
  page,
}) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        publicLaunch: false,
        retentionHours: 24,
        ready: true,
        blockers: [],
        account,
      },
    }),
  );
  await page.route("https://example.supabase.co/auth/v1/token**", (r) => {
    expect(r.request().postDataJSON().email).toBe("member@example.com");
    return r.fulfill({
      status: 400,
      json: {
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      },
    });
  });
  await page.goto("/?account=1");
  await page.getByLabel("이메일", { exact: true }).fill("member@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("invalid-password");
  await page
    .getByRole("button", { name: "현도컴퍼니 계정으로 로그인" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "이메일과 비밀번호를 확인",
  );
});
test("saved history renders, deletion requires confirmation and logout clears records (auth simulated)", async ({
  page,
}) => {
  const result = makeAnalysis(defaultIntake, randomUUID(), "mock", "demo");
  const entry = {
    id: randomUUID(),
    input: defaultIntake,
    result,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  let rows = [entry];
  await page.addInitScript(
    ({ userId }) =>
      localStorage.setItem(
        "banglog-plus-auth",
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            email: "test@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { userId },
  );
  await page.route("https://example.supabase.co/**", (r) =>
    r.fulfill({ json: {} }),
  );
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        publicLaunch: false,
        retentionHours: 24,
        ready: true,
        blockers: [],
        account,
      },
    }),
  );
  await page.route("**/api/account/history**", (r) => {
    expect(r.request().headers().authorization).toBe("Bearer test-token");
    if (r.request().method() === "DELETE") {
      rows = [];
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: rows });
  });
  await page.goto("/?account=1");
  await expect(
    page.getByText("로그인되어 있어요.", { exact: false }),
  ).toBeVisible();
  await page.getByText("결과와 근거 펼쳐보기", { exact: true }).click();
  await expect(
    page.locator(".saved-message").filter({ hasText: result.messageDraft }),
  ).toBeVisible();
  await page.getByRole("button", { name: "기록 삭제", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(rows.length).toBe(1);
  await page.getByRole("button", { name: "기록 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(
    page.getByText("아직 저장한 기록이 없어요.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "현도컴퍼니 계정으로 로그인" }),
  ).toBeVisible();
});

test("signup requires consent, uses confirmation redirect and supports email resend (simulated)", async ({
  page,
}) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        publicLaunch: false,
        retentionHours: 24,
        ready: true,
        blockers: [],
        account: { ...account, signup: true },
      },
    }),
  );
  let requested = false;
  await page.route("https://example.supabase.co/auth/v1/signup**", (r) => {
    const body = r.request().postDataJSON();
    expect(body.email).toBe("signup@example.com");
    expect(new URL(r.request().url()).searchParams.get("redirect_to")).toBe(
      `${new URL(page.url()).origin}/?account=1`,
    );
    requested = true;
    return r.fulfill({
      json: {
        user: { id: userId, email: "signup@example.com", identities: [] },
        session: null,
      },
    });
  });
  await page.route("https://example.supabase.co/auth/v1/resend**", (r) =>
    r.fulfill({ json: {} }),
  );
  await page.goto("/?account=1");
  await page.getByRole("button", { name: "처음 오셨나요? 회원가입" }).click();
  await page.getByLabel("이메일", { exact: true }).fill("signup@example.com");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("test-signup-password");
  await page
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("different-password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "회원가입하기" }).click();
  await expect(page.getByRole("alert")).toContainText("비밀번호가 일치하지");
  await page.getByRole("checkbox").uncheck();
  await page
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("test-signup-password");
  await expect(
    page.getByRole("button", { name: "회원가입하기" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "회원가입하기" }).click();
  await expect(page.getByRole("status")).toContainText("인증 메일을 확인");
  expect(requested).toBe(true);
  await page.getByRole("button", { name: "인증 메일 다시 보내기" }).click();
  await expect(page.getByRole("status")).toContainText("인증 메일을 다시 요청");
});

test("mobile edited message survives navigation and saves separately with consent (auth simulated)", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const result = makeAnalysis(defaultIntake, randomUUID(), "mock", "demo");
  let rows: {
    id: string;
    input: typeof defaultIntake;
    result: typeof result & { savedMessage?: string };
    createdAt: string;
    expiresAt: string;
  }[] = [];
  await page.addInitScript(
    ({ userId }) =>
      localStorage.setItem(
        "banglog-plus-auth",
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id: userId,
            email: "test@example.com",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { userId },
  );
  await page.route("https://example.supabase.co/**", (r) =>
    r.fulfill({ json: {} }),
  );
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        publicLaunch: false,
        retentionHours: 24,
        ready: true,
        blockers: [],
        account,
      },
    }),
  );
  await page.route("**/api/sessions", (r) =>
    r.fulfill({
      status: 201,
      json: {
        token: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  await page.route("**/api/analyses", (r) => {
    result.inputVersion = r.request().postDataJSON().intake.inputVersion;
    return r.fulfill({ json: result });
  });
  await page.route("**/api/analyses/*/events", (r) =>
    r.fulfill({ status: 204 }),
  );
  await page.route("**/api/account/history", (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      expect(body.editedMessage).toBe(
        "안녕하세요. 내일 점검 가능한 시간을 알려주세요.",
      );
      expect(body.consentVersion).toBe("2026-11-03.history-v1");
      expect(r.request().headers()["x-guest-token"]).toBe("a".repeat(64));
      rows = [
        {
          id: randomUUID(),
          input: defaultIntake,
          result: { ...result, savedMessage: body.editedMessage },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ];
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: rows });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "곰팡이가 생겼어요" }).click();
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await page.getByRole("button", { name: "집주인에게 보낼 문구 보기" }).click();
  await page
    .getByLabel("집주인에게 보낼 문구")
    .fill("안녕하세요. 내일 점검 가능한 시간을 알려주세요.");
  await page.getByRole("button", { name: "문구 복사하기" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "안녕하세요. 내일 점검 가능한 시간을 알려주세요.",
  );
  await page.getByLabel("내 이름 (선택)").fill("김테스트");
  await page.getByLabel("거주지 호수 (선택)").fill("302호");
  await expect(page.getByLabel("복사할 최종 문구")).toHaveValue(
    "안녕하세요. 302호에 거주하는 김테스트입니다.\n내일 점검 가능한 시간을 알려주세요.",
  );
  await page.getByRole("button", { name: "문구 복사하기" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "302호에 거주하는 김테스트입니다.",
  );
  await page.getByRole("button", { name: "처음 문구로 되돌리기" }).click();
  await page.getByRole("button", { name: "수정 유지" }).click();
  await page.screenshot({
    path: "docs/screenshots/message-edit-mobile.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("link", { name: "민법 제634조 · 통지의무 ↗" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "문구와 결과를 내 기록에 저장" })
    .click();
  await expect(
    page.getByRole("button", { name: "내 기록에 저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "내 기록에 저장", exact: true })
    .click();
  await expect(
    page.getByText("내 기록에 저장했어요.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "내 기록에 저장", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/history-saved-mobile.png",
    fullPage: true,
  });
  await page.goto("/?account=1");
  await page.getByText("문구 수정·복사하기", { exact: true }).click();
  await expect(page.getByLabel("저장한 문구 수정")).toHaveValue(
    "안녕하세요. 내일 점검 가능한 시간을 알려주세요.",
  );
  await page.getByLabel("저장한 문구 수정").fill("후속 연락용으로 수정했어요.");
  await page.getByRole("button", { name: "문구 복사하기" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "후속 연락용으로 수정했어요.",
  );
  expect(rows[0].result.messageDraft).toBe(result.messageDraft);
  await page.setViewportSize({ width: 390, height: 400 });
  await page.getByLabel("저장한 문구 수정").focus();
  await page
    .getByRole("button", { name: "문구 복사하기" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "문구 복사하기" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("signup without confirmation opens member history immediately (auth simulated)", async ({
  page,
}) => {
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "new@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ai: "mock",
        storage: "database",
        publicLaunch: false,
        retentionHours: 24,
        ready: true,
        blockers: [],
        account: { ...account, signup: true },
      },
    }),
  );
  await page.route("https://example.supabase.co/auth/v1/signup**", (r) => {
    expect(r.request().postDataJSON().password).toBe("new-member-password");
    expect(r.request().postDataJSON()).not.toHaveProperty("confirmation");
    return r.fulfill({
      json: {
        access_token: "simulated-new-member",
        refresh_token: "simulated-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    });
  });
  await page.route("https://example.supabase.co/auth/v1/user", (r) =>
    r.fulfill({ json: user }),
  );
  await page.route("**/api/account/history", (r) => {
    expect(r.request().headers().authorization).toBe(
      "Bearer simulated-new-member",
    );
    return r.fulfill({ json: [] });
  });
  await page.goto("/?account=1");
  await page.getByRole("button", { name: "처음 오셨나요? 회원가입" }).click();
  await page.getByLabel("이메일", { exact: true }).fill("new@example.com");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("new-member-password");
  await page
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("new-member-password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "회원가입하기" }).click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("인증 메일을 확인해 주세요.", { exact: false }),
  ).toHaveCount(0);
});
