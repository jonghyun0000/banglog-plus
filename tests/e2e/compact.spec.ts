import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [360, 390])
  test(`compact question layout ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
      .click();
    await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
    await expect(page.getByText("내 상황 확인", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("AI 보조 안내 · 출처 확인 필요", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("앞선 답변 수정", { exact: true })).toHaveCount(
      0,
    );
    const first = page.getByRole("button", {
      name: "온수가 나오지 않아요",
      exact: true,
    });
    const next = page.getByRole("button", { name: "다음", exact: true });
    const firstBox = await first.boundingBox(),
      nextBox = await next.boundingBox();
    expect(firstBox!.y).toBeGreaterThan(0);
    expect(firstBox!.y + firstBox!.height).toBeLessThan(nextBox!.y);
    expect(nextBox!.y + nextBox!.height).toBeLessThanOrEqual(640);
    await expect(next).toHaveClass(/primary/);
    const last = page.getByRole("button", {
      name: "잘 모르겠어요",
      exact: true,
    });
    const lastBox = await last.boundingBox();
    const actionsBox = await page.locator(".question-actions").boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(actionsBox!.y);
    await page.screenshot({ path: `.local/compact-question-${width}.png` });
    await first.click();
    await expect(
      page.getByRole("button", { name: "다음", exact: true }),
    ).toHaveClass(/primary/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("danger stays below choices, does not jump, and blocks the next step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
  await page
    .getByRole("button", { name: "온수가 나오지 않아요", exact: true })
    .click();
  const danger = page.getByLabel("위험 신호 직접 입력");
  await danger.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await danger.fill("가스 냄새가 나요");
  await expect(page.getByRole("alert")).toContainText(
    "지금은 안전 확인이 먼저예요",
  );
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    5,
  );
  const positions = await page.evaluate(() => ({
    choices: document
      .querySelector(".question-screen fieldset")!
      .getBoundingClientRect().bottom,
    alert: document.querySelector(".safety-notice")!.getBoundingClientRect()
      .top,
  }));
  expect(positions.alert).toBeGreaterThanOrEqual(positions.choices);
  await expect(
    page.getByRole("button", { name: "위험 신호가 있어 진행을 중단했어요" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "119에 전화하기" }),
  ).toHaveAttribute("href", "tel:119");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: ".local/compact-danger.png", fullPage: true });
});
