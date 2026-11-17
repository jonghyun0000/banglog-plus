import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const language of ["ko", "en"] as const) {
  test(`free safety input is reviewed (${language})`, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?lang=${language}`);
    await page
      .getByRole("button", {
        name: en ? "A light isn’t working" : "전구가 고장났어요",
        exact: true,
      })
      .click();
    // Choosing a symptom advances to the safety question.
    await page.locator(".choices button").first().click();
    const field = page.getByLabel(
      en ? "Describe any other safety concern" : "위험 신호 직접 입력",
    );
    await expect(field).toBeVisible();
    await expect(page.locator(".safety-input .choices button")).toHaveCount(1);
    await field.fill(en ? "I smell gas" : "가스 냄새가 나요");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".question-actions button")).toBeDisabled();
    const concern = en
      ? "I have not checked the breaker yet"
      : "차단기 상태를 확인하지 못했어요";
    await field.fill(concern);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.locator(".question-actions button").click();
    for (let i = 0; i < 15; i++) {
      if (
        await page
          .getByLabel(en ? "Additional details" : "추가로 설명할 내용")
          .isVisible()
      )
        break;
      if (await page.locator(".question-actions button:disabled").count())
        await page.locator(".choices button").first().click();
      else await page.locator(".question-actions button").click();
    }
    await page.locator(".question-actions button").click();
    await expect(page.getByText(concern, { exact: true })).toBeVisible();
  });
}
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`spinner and elapsed time work while session starts (${reducedMotion})`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 360, height: 640 });
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/sessions", async (route) => {
      await waiting;
      await route
        .fulfill({
          status: 503,
          json: { message: "연결을 다시 확인해 주세요." },
        })
        .catch(() => {});
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
      .click();
    await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
    for (let i = 0; i < 15; i++) {
      if (await page.getByLabel("추가로 설명할 내용").isVisible()) break;
      await page.getByRole("button", { name: "다음", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "입력한 내용 확인하기", exact: true })
      .click();
    await page.locator(".processing-notice").getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "수리 가이드 확인하기", exact: true })
      .click();
    try {
      const ring = page.locator(".loading-ring");
      await expect(ring).toBeVisible();
      const before = await ring.evaluate((e) => getComputedStyle(e).transform);
      await expect
        .poll(() => ring.evaluate((e) => getComputedStyle(e).transform))
        .not.toBe(before);
      expect(
        await ring.evaluate((e) =>
          e.getAnimations().some((a) => a.playState === "running"),
        ),
      ).toBe(true);
      await expect(page.getByRole("timer")).not.toHaveText(
        "분석 진행 중 · 0초 경과",
        { timeout: 4000 },
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`loading-${reducedMotion}.png`),
      });
      await page
        .getByRole("button", { name: "분석 취소하기", exact: true })
        .click();
      await expect(ring).toHaveCount(0);
    } finally {
      release();
    }
  });
}
