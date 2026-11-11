import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function additional(page: Page) {
  for (let i = 0; i < 15; i++) {
    if (await page.getByLabel("추가로 설명할 내용").isVisible()) return;
    await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  throw new Error("Additional explanation step not reached");
}

for (const issue of [
  "곰팡이가 생겼어요",
  "물이 새요",
  "보일러가 고장 났어요",
  "벽지·장판이 손상됐어요",
  "배수가 안 돼요",
  "집에 설치된 옵션에 문제가 있어요",
]) {
  test(`hosted demo journey: ${issue}`, async ({ page, context }) => {
    const errors: string[] = [],
      dataRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["fetch", "xhr"].includes(r.resourceType()) || r.method() !== "GET")
        dataRequests.push(r.url());
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "집 수리비, 누가 부담하나요?" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
      .click();
    await page.getByRole("button", { name: issue }).click();
    const selected =
      issue === "벽지·장판이 손상됐어요"
        ? "장판에 찍힘이 있어요"
        : issue === "배수가 안 돼요"
          ? "물이 역류해요"
          : issue === "집에 설치된 옵션에 문제가 있어요"
            ? "침대가 파손됐어요"
            : null;
    if (selected)
      await page.getByRole("button", { name: selected, exact: true }).click();
    await additional(page);
    await page
      .getByLabel("추가로 설명할 내용")
      .fill("증상이 계속되어 점검을 요청하고 싶어요.");
    await additional(page);
    await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
    await expect(
      page.getByText("입력·결과·피드백은 현재 페이지의 메모리에만", {
        exact: false,
      }),
    ).toBeVisible();
    if (selected)
      await expect(page.getByText(selected, { exact: true })).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    await expect(
      page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
      .click();
    if (selected)
      await expect(
        page.getByRole("textbox", {
          name: "집주인에게 보낼 문구",
          exact: true,
        }),
      ).toHaveValue(new RegExp(selected));
    await page.getByRole("button", { name: "문구 복사하기" }).click();
    await expect(page.getByText("복사됐어요.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "점검",
    );
    await page.getByRole("button", { name: "도움이 됐는지 알려주기" }).click();
    await page
      .getByRole("button", { name: "의견 남기기", exact: true })
      .click();
    await expect(
      page.getByText("운영자에게는 전달되지 않아요.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "현재 세션 기록 삭제" }).click();
    await page.getByRole("button", { name: "기록 삭제 확인" }).click();
    await expect(
      page.getByText("현재 세션의 브라우저 기록을 삭제했어요."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "집 수리비, 누가 부담하나요?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "현재 세션 기록 삭제" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    ).toEqual([0, 0]);
    expect(dataRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("reference library keeps court scopes separate from the demo result", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "수리 전 참고 판례 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "비슷한 사건도 조건이 달라요" }),
  ).toBeVisible();
  await expect(
    page.getByText("주택 옵션 가전 사건은 아니에요.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "국가법령정보센터 판결 원문" }),
  ).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/references-390x844.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "내 상황 확인하기" }).click();
  await expect(
    page.getByRole("heading", { name: "어떤 문제가 생겼나요?" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/issues-390x844.png",
    fullPage: true,
  });
});

test("own fridge goes to service support and keeps the expanded reference accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page
    .getByRole("button", { name: "집에 설치된 옵션에 문제가 있어요" })
    .click();
  await page.getByRole("button", { name: "냉장고가 작동하지 않아요" }).click();
  await page
    .getByRole("button", { name: "지금 위험 신호는 없어요", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "제가 설치한 시설이에요" }).click();
  await additional(page);
  await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByRole("heading", { name: "제조사·수리업체에 문의해요" }),
  ).toBeVisible();
  await page.getByText("관련 판례 원문과 적용 한계", { exact: true }).click();
  await expect(
    page.getByText("주택 옵션 가전 사건은 아니에요.", { exact: false }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "수리업체에 보낼 문구 보기" }).click();
  await expect(
    page.getByRole("textbox", { name: "제조사·수리업체에 보낼 문구" }),
  ).toHaveValue(/보증 적용/);
});
