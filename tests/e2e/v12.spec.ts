import { test, expect } from "@playwright/test";
import { makeAnalysis } from "../../shared/analysis";
test("v1.2 mobile: confirm choices, back edit, custom location and natural message", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sessions", (r) =>
    r.fulfill({ status: 201, json: { token: "v12-test" } }),
  );
  await page.route("**/api/analyses", (r) =>
    r.fulfill({
      json: makeAnalysis(
        r.request().postDataJSON().intake,
        "00000000-0000-4000-8000-000000000001",
        "mock",
        "test",
      ),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "배수가 안 돼요" }).click();
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  await page.getByLabel("선택 후 바로 이동").uncheck();
  await click("물이 천천히 내려가요");
  await expect(
    page.getByRole("group", { name: "지금 보이는 증상" }),
  ).toBeVisible();
  await click("물이 잘 내려가지 않아요");
  await click("다음");
  await click("직접 입력하기");
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("배수가 안 되는 곳", { exact: true })
    .fill("베란다 배수구");
  await page.getByLabel("선택 후 바로 이동").check();
  await click("다음");
  await expect(page.getByText("앞선 답변 수정", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(
    page.getByLabel("배수가 안 되는 곳", { exact: true }),
  ).toHaveValue("베란다 배수구");
  await click("다음");
  for (const name of [
    "이곳 한 군데만 그래요",
    "넘치거나 주변으로 새지는 않아요",
    "지금 위험 신호는 없어요",
    "배수구 약품은 넣지 않았어요",
    "아직 해본 조치는 없어요",
  ])
    await click(name);
  await page
    .getByRole("radio", { name: "입주 후 처음 생겼어요", exact: true })
    .check();
  await click("다음");
  await click("아직 연락하지 않았어요");
  await click("입력한 내용 확인하기");
  await expect(page.locator(".review-list")).toContainText("베란다 배수구");
  await page.getByRole("checkbox").check();
  await click("수리 가이드 확인하기");
  await click("집주인에게 보낼 문구 보기");
  const draft = page.locator("textarea").first();
  await expect(draft).toContainText("베란다 배수구");
  expect(await draft.inputValue()).not.toContain("문제 문제");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/v12-message-mobile.png",
    fullPage: true,
  });
});
test("v1.2 dangerous custom text blocks progress immediately", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "배수가 안 돼요" }).click();
  await page
    .getByRole("button", { name: "물이 천천히 내려가요", exact: true })
    .click();
  await page
    .getByRole("button", { name: "직접 입력하기", exact: true })
    .click();
  await page
    .getByLabel("배수가 안 되는 곳", { exact: true })
    .fill("감전 위험이 있는 배수구");
  await expect(
    page.getByRole("button", { name: "위험 신호가 있어 진행을 중단했어요" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "119에 전화하기" }),
  ).toHaveAttribute("href", "tel:119");
});
