import { test, expect } from "@playwright/test";
import { makeAnalysis } from "../../shared/analysis";
test("quick answers persist, free text is last, and review edits return directly", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "벽지·장판이 손상됐어요" }).click();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "장판에 찍힘이 있어요", exact: true })
    .click();
  await page
    .getByRole("button", { name: "지금 위험 신호는 없어요", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "언제부터 있었던 문제인가요?" }),
  ).toBeFocused();
  await page
    .getByRole("radio", { name: "오늘 발견했어요", exact: true })
    .check();
  await page
    .getByRole("radio", { name: "입주 때도 있었어요", exact: true })
    .check();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "집에 원래 있던 시설이에요", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "비용을 부담하라는 답을 받았어요",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "아직 원인을 몰라요", exact: true })
    .click();
  await expect(
    page.getByText("누구에게 들었나요?", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await page
    .getByLabel("추가로 설명할 내용")
    .fill("입주 사진이 있어요. 계약서에는 시설 수리 협의라고 적혀 있어요.");
  await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
  await page
    .getByRole("button", { name: "보이는 증상 수정", exact: true })
    .click();
  await page
    .getByRole("button", { name: "벽지가 찢어졌어요", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "이 내용으로 확인할까요?" }),
  ).toBeVisible();
  await expect(
    page.getByText("벽지가 찢어졌어요", { exact: true }),
  ).toBeVisible();
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/analyses") && r.method() === "POST",
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  const input = (await request).postDataJSON().intake;
  expect(input).toMatchObject({
    observation: "wall-tear",
    discovered: "today",
    preexisting: "yes",
    installed: "original",
    cause: "unknown",
    causeSource: "unknown",
    contact: "cost",
    safety: "none",
    contract: "",
  });
  expect(input.description).toContain("계약서에는 시설 수리 협의");
});
test("danger selection stops automatic navigation before situation questions", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
  await page
    .getByRole("button", { name: "잘 모르겠어요", exact: true })
    .click();
  await page
    .getByRole("button", { name: "가스 냄새가 나요", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "지금 위험 신호가 있나요?" }),
  ).toBeVisible();
  await expect(page.getByText("지금은 안전 확인이 먼저예요")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "위험 신호가 있어 진행을 중단했어요" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "119에 전화하기" }),
  ).toHaveAttribute("href", "tel:119");
  await expect(page.getByLabel("추가로 설명할 내용")).toHaveCount(0);
});

test("mobile choices, back navigation and result actions stay clear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 201,
      json: {
        token: "mobile-ui-test",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  await page.route("**/api/analyses", (route) =>
    route.fulfill({
      json: makeAnalysis(
        route.request().postDataJSON().intake,
        "00000000-0000-4000-8000-000000000001",
        "mock",
        "demo",
      ),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
    .click();
  await page.getByRole("button", { name: "벽지·장판이 손상됐어요" }).click();
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(
    page.getByRole("heading", { name: "어떤 문제가 생겼나요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "벽지·장판이 손상됐어요" }).click();
  await page.screenshot({
    path: "docs/screenshots/mobile-symptoms.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "장판에 찍힘이 있어요", exact: true })
    .click();
  await page
    .getByRole("button", { name: "지금 위험 신호는 없어요", exact: true })
    .click();

  await page
    .getByRole("radio", { name: "오늘 발견했어요", exact: true })
    .check();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "일주일 안에 발견했어요", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("radio", { name: "입주 때도 있었어요", exact: true })
    .check();
  await expect(
    page.getByRole("radio", { name: "일주일 안에 발견했어요", exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: "docs/screenshots/mobile-timing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "집에 원래 있던 시설이에요", exact: true })
    .click();
  await page
    .getByRole("button", { name: "아직 연락하지 않았어요", exact: true })
    .click();
  await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByRole("heading", { name: /수리 가이드$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/mobile-result-overview.png",
  });
  const request = await page.locator(".result-contact").boundingBox();
  expect(request!.y + request!.height).toBeLessThan(844);
  await page
    .getByRole("button", { name: "내 기록에 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "현도컴퍼니 계정으로 로그인" }),
  ).toBeVisible();
});
