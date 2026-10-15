import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function pick(page: Page, issue = "보일러가 고장 났어요") {
  await page.goto("/");
  await page.getByRole("button", { name: "내 상황 확인하기" }).click();
  await page.getByRole("button", { name: issue }).click();
}
async function review(page: Page) {
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
}
async function analyze(page: Page) {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
for (const [w, h] of [
  [360, 640],
  [390, 844],
  [1440, 900],
])
  test(`viewport ${w}x${h} complete journey + screenshots + accessibility`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "이거, 누가 고쳐야 하지?" }),
    ).toBeVisible();
    const button = page.getByRole("button", { name: "내 상황 확인하기" });
    const box = await button.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(h);
    await noOverflow(page);
    await page.screenshot({
      path: `docs/screenshots/home-${w}x${h}.png`,
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await button.click();
    await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
    await page
      .getByLabel("상황 설명")
      .fill("보일러 전원은 켜지는데 온수가 나오지 않아요.");
    await page.screenshot({
      path: `docs/screenshots/questions-${w}x${h}.png`,
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await review(page);
    await page.getByRole("button", { name: "상황 수정", exact: true }).click();
    await page
      .getByLabel("상황 설명")
      .fill("온수가 나오지 않고 오류 표시가 보여요.");
    await review(page);
    await analyze(page);
    await noOverflow(page);
    await page.screenshot({
      path: `docs/screenshots/result-${w}x${h}.png`,
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
      .click();
    await page.screenshot({
      path: `docs/screenshots/message-${w}x${h}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "문구 복사하기" }).click();
    await expect(page.getByText("복사됐어요.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "보일러 고장",
    );
    await page.getByRole("button", { name: "도움이 됐는지 알려주기" }).click();
    await page
      .getByRole("button", { name: "의견 남기기", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "의견을 남겨주셔서 감사해요" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "현재 세션 기록 삭제" }).click();
    await page.getByRole("button", { name: "기록 삭제 확인" }).click();
    await expect(
      page.getByText("현재 세션의 서버 기록을 삭제했어요.", { exact: false }),
    ).toBeVisible();
  });
for (const issue of ["곰팡이가 생겼어요", "물이 새요"])
  test(`text-only ${issue} and copy fallback`, async ({ page }) => {
    await pick(page, issue);
    await review(page);
    await analyze(page);
    await page
      .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
      .click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {
            throw new Error("blocked");
          },
        },
        configurable: true,
      });
    });
    await page.getByRole("button", { name: "문구 복사하기" }).click();
    await expect(page.getByRole("alert")).toContainText("직접 복사");
    await expect(page.getByText("복사됐어요.", { exact: false })).toHaveCount(
      0,
    );
  });
test("safety appears while typing and before analysis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pick(page);
  await page.getByLabel("상황 설명").fill("가스 냄새가 나요.");
  await expect(page.getByRole("alert")).toContainText("안전한 곳에서 119");
  await page.screenshot({
    path: "docs/screenshots/safety-390x844.png",
    fullPage: true,
  });
});
test("long text, 200% text zoom, focus, browser back", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  await noOverflow(page);
  await page.screenshot({
    path: "docs/screenshots/home-200-percent.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "내 상황 확인하기" }).click();
  await page.getByRole("button", { name: "물이 새요" }).click();
  await page
    .getByLabel("상황 설명")
    .fill("천장에서 물이 조금씩 떨어지는 상황입니다. ".repeat(20));
  await noOverflow(page);
  await page.screenshot({
    path: "docs/screenshots/questions-long-200-percent.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "언제부터 보였나요?" }),
  ).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "어떤 상황인가요?" }),
  ).toBeVisible();
  await review(page);
  await analyze(page);
  await noOverflow(page);
  await page.screenshot({
    path: "docs/screenshots/result-long-200-percent.png",
    fullPage: true,
  });
});
test("loading, cancellation, provider error and retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pick(page);
  await review(page);
  await page.route("**/api/analyses", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({
        code: "PROVIDER_TIMEOUT",
        message:
          "AI 응답 시간이 초과됐어요. 내용을 확인하고 다시 시도해 주세요.",
      }),
    });
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByRole("button", { name: "분석 취소하기" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/loading-390x844.png",
    fullPage: true,
  });
  await expect(page.getByRole("alert")).toContainText("응답 시간이 초과");
  await page.screenshot({
    path: "docs/screenshots/error-390x844.png",
    fullPage: true,
  });
  await page.unroute("**/api/analyses");
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
  ).toBeVisible();
});
test("cancel returns to review and stale output is hidden", async ({
  page,
}) => {
  await pick(page);
  await review(page);
  await page.route("**/api/analyses", async (route) => {
    await new Promise((r) => setTimeout(r, 1000));
    await route.abort();
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await page.getByRole("button", { name: "분석 취소하기" }).click();
  await expect(
    page.getByRole("heading", { name: "이 내용으로 확인할까요?" }),
  ).toBeVisible();
  await expect(
    page.getByText("분석을 취소했어요.", { exact: false }),
  ).toBeVisible();
});

for (const [width, height] of [
  [360, 640],
  [390, 844],
  [1440, 900],
]) {
  test(`state matrix ${width}x${height}: long input, loading, error, enlarged result`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await pick(page, "물이 새요");
    await page
      .getByLabel("상황 설명")
      .fill(
        "비가 오는 날 천장 모서리에서 물이 떨어지는 상황을 기록했습니다. ".repeat(
          15,
        ),
      );
    await noOverflow(page);
    await page.screenshot({
      path: `docs/screenshots/long-input-${width}x${height}.png`,
      fullPage: true,
    });
    await review(page);
    await page.route("**/api/analyses", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        }),
      });
    });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    await expect(
      page.getByRole("button", { name: "분석 취소하기" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `docs/screenshots/loading-${width}x${height}.png`,
      fullPage: true,
    });
    await expect(page.getByRole("alert")).toContainText("요청이 많아요");
    await page.screenshot({
      path: `docs/screenshots/error-${width}x${height}.png`,
      fullPage: true,
    });
    await page.unroute("**/api/analyses");
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    await expect(
      page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
    ).toBeVisible();
    await page.getByText("입력한 내용 보기", { exact: true }).click();
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "32px"),
    );
    await noOverflow(page);
    await page.screenshot({
      path: `docs/screenshots/result-expanded-200-percent-${width}x${height}.png`,
      fullPage: true,
    });
  });
}
test("keyboard-sized viewport keeps editable text and controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await pick(page);
  await page.getByLabel("상황 설명").focus();
  await expect(page.getByLabel("상황 설명")).toBeFocused();
  await noOverflow(page);
  await page
    .getByRole("button", { name: "다음", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeVisible();
});
