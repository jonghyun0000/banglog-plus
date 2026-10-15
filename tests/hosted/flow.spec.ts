import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const issue of [
  "곰팡이가 생겼어요",
  "물이 새요",
  "보일러가 고장 났어요",
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
      page.getByRole("heading", { name: "이거, 누가 고쳐야 하지?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "내 상황 확인하기" }).click();
    await page.getByRole("button", { name: issue }).click();
    await page
      .getByLabel("상황 설명")
      .fill("증상이 계속되어 점검을 요청하고 싶어요.");
    for (let i = 0; i < 6; i++)
      await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
    await expect(
      page.getByText("입력·결과·피드백은 현재 페이지의 메모리에만", {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    await expect(
      page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
      .click();
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
      page.getByRole("heading", { name: "이거, 누가 고쳐야 하지?" }),
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
