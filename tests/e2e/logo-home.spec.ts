import { test, expect, type Page } from "@playwright/test";

const click = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();

async function readyForAnalysis(page: Page) {
  await page.goto("/");
  await click(page, "전구가 고장났어요");
  await click(page, "전구 한 개가 켜지지 않아요");
  await click(page, "지금 위험 신호는 없어요");
  await click(page, "전구·형광등만 바꿀 수 있어요");
  await click(page, "집에 원래 있던 시설이에요");
  await click(page, "아직 연락하지 않았어요");
  await page.getByLabel("추가로 설명할 내용").fill("주방 전구 한 개");
  await click(page, "입력한 내용 확인하기");
  await page.locator(".processing-notice").getByRole("checkbox").check();
}

for (const language of ["ko", "en"]) {
  test(`logo returns home without reloading or clearing input (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/?lang=${language}`);
    await click(
      page,
      language === "ko" ? "전구가 고장났어요" : "A light isn’t working",
    );
    const heading = await page.getByRole("heading", { level: 1 }).innerText();
    await page.evaluate(() =>
      sessionStorage.setItem("logo-home-sentinel", "preserved"),
    );
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    const logo = page.getByRole("button", {
      name:
        language === "ko" ? "방로그 Plus 처음 화면으로" : "Banglog Plus home",
      exact: true,
    });
    await logo.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".home")).toBeVisible();
    expect(
      await logo.evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => sessionStorage.getItem("logo-home-sentinel")),
    ).toBe("preserved");
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await page.screenshot({ path: `.local/logo-home/${language}-mobile.png` });
  });
}

for (const delayed of ["sessions", "analyses"]) {
  test(`home stays visible when a pending ${delayed} request fails`, async ({
    page,
  }) => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    await page.route("**/api/sessions", async (route) => {
      if (delayed === "sessions") {
        entered();
        await barrier;
        await route.fulfill({ status: 503, json: { message: "test failure" } });
      } else {
        await route.fulfill({ status: 201, json: { token: "logo-home-test" } });
      }
    });
    await page.route("**/api/analyses", async (route) => {
      entered();
      await barrier;
      await route.fulfill({ status: 503, json: { message: "test failure" } });
    });
    await page.route("**/api/analyses/cancel", (route) =>
      route.fulfill({ json: { ok: true } }),
    );
    await readyForAnalysis(page);
    await click(page, "수리 가이드 확인하기");
    await started;
    await click(page, "방로그 Plus 처음 화면으로");
    await expect(page.locator(".home")).toBeVisible();
    release();
    // Allow the late network failure to settle before checking the visible screen.
    await page.waitForTimeout(350);
    await expect(page.locator(".home")).toBeVisible();
    await click(page, "전구가 고장났어요");
    await expect(
      page.getByRole("button", {
        name: "전구 한 개가 켜지지 않아요",
        exact: true,
      }),
    ).toBeVisible();
  });
}
