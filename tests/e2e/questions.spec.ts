import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeAnalysis } from "../../shared/analysis";
import { loadConfig } from "../../server/config";
import { createApp } from "../../server/routes/app";
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
  await page.getByLabel("위험 신호 직접 입력").fill("가스 냄새가 나요");
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

test("lighting can be selected from home or the issue list, and answers use plain dots", async ({
  page,
}) => {
  const { app } = createApp({ config: loadConfig({}) });
  try {
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    await page.route("**/api/{sessions,analyses}", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const response = await route.fetch({
        url: new URL(path, address).href,
      });
      await route.fulfill({ response });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "전구가 고장났어요", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "전구 한 개가 켜지지 않아요" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "뒤로가기" }).click();
    await page.getByRole("button", { name: "전구가 고장났어요" }).click();
    await page.getByRole("checkbox", { name: "선택 후 바로 이동" }).uncheck();
    const symptom = page.getByRole("button", {
      name: "전구를 바꿔도 켜지지 않아요",
    });
    await symptom.click();
    await expect(symptom).toHaveAttribute("aria-pressed", "true");
    await expect(symptom.locator(".radio-mark")).toBeEmpty();
    await expect(symptom.locator(".radio-mark")).toHaveCSS(
      "background-color",
      "rgb(37, 99, 235)",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: ".local/screenshots/lighting-choices-390x844.png",
    });
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page
      .getByLabel("위험 신호 직접 입력")
      .fill("연기·불꽃·타는 냄새가 나요");
    await expect(
      page.getByRole("link", { name: "119에 전화하기" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "위험 신호가 있어 진행을 중단했어요" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: "선택 후 바로 이동" }).check();
    await page.getByRole("button", { name: "지금 위험 신호는 없어요" }).click();
    await expect(
      page.getByRole("heading", { name: "어떤 형태의 조명인가요?" }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "전구·형광등만 바꿀 수 있어요" })
      .click();
    await page.getByRole("radio", { name: "오늘 발견했어요" }).check();
    const timingDot = page
      .locator("label.choice")
      .filter({ hasText: "오늘 발견했어요" })
      .locator(".radio-mark");
    await expect(timingDot).toBeEmpty();
    await expect(timingDot).toHaveCSS("background-color", "rgb(37, 99, 235)");
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page
      .getByRole("button", { name: "집에 원래 있던 시설이에요" })
      .click();
    await page.getByRole("button", { name: "아직 연락하지 않았어요" }).click();
    await page.getByLabel("고장 위치").fill("거실 천장 가운데 등");
    await page.getByLabel("고장 난 조명 개수").fill("1");
    await page.getByLabel("어떤 작업을 안내받았나요?").selectOption("whole");
    await page.getByText("발견 기록·계약 특약 (선택)", { exact: true }).click();
    await page.getByLabel("수리 진행 상태 (선택)").selectOption("before");
    await page
      .getByLabel("관련 계약 특약 (선택)")
      .fill("조명 수리 범위는 협의");
    await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
    await expect(
      page.getByText("전구·형광등만 바꿀 수 있어요", { exact: true }),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    await expect(
      page.getByRole("heading", { name: "전구·조명 수리 가이드" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "핵심 요약" })).toContainText(
      "조명 설비 점검을 요청하기",
    );
    await page.getByRole("link", { name: /조명 규격·제품 가격/ }).click();
    const prices = page.getByRole("region", { name: "조명 규격·제품 가격" });
    const product = prices.getByRole("combobox", { name: "내 조명 종류" });
    await expect(product.locator("option")).toHaveText([
      "조명 종류 선택",
      "일반 LED 전구",
      "FPL 형광등",
    ]);
    await expect(prices).not.toContainText("1,900원");
    await product.selectOption("led-bulb");
    await expect(prices).toContainText("약 1,900원");
    await expect(prices).toContainText("E26 소켓");
    await expect(prices).not.toContainText("2,950원");
    await product.selectOption("fpl");
    await expect(prices).toContainText("약 2,950원");
    await expect(prices).not.toContainText("1,900원");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
      .click();
    await expect(
      page.getByRole("textbox", { name: "집주인에게 보낼 문구" }),
    ).toHaveValue(/전구를 바꿔도 켜지지 않아요/);
    await expect(
      page.getByRole("textbox", { name: "집주인에게 보낼 문구" }),
    ).toHaveValue(/특약이 이번 작업의 어느 항목과 범위/);
    const draft = page.getByRole("textbox", { name: "집주인에게 보낼 문구" });
    await expect(draft).toHaveValue(/거실 천장 가운데 등/);
    await expect(draft).toHaveValue(/고장 조명은 1개/);
    await expect(draft).toHaveValue(/부분|부품만 보수하기 어려운 이유/);
    await expect(draft).toHaveValue(/부품비·공임·출장비를 구분한 항목별 견적/);
  } finally {
    await app.close();
  }
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
    .getByRole("button", { name: "벽지에 찍힘이 있어요", exact: true })
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
  await page.getByRole("link", { name: /6건 보기/ }).click();
  const costs = page.getByRole("region", { name: "비슷한 수리 비용 사례" });
  await expect(costs.getByRole("listitem")).toHaveCount(3);
  await expect(costs).not.toContainText("장판");
  const more = costs.getByRole("button", {
    name: "관련 견적·사례 더 보기 (3건)",
  });
  const dialog = page.getByRole("dialog", { name: "추가 수리비 자료" });
  await expect(dialog).toHaveCount(0);
  await more.click();
  await expect(dialog).toBeInViewport();
  await expect(dialog.getByRole("listitem")).toHaveCount(3);
  await expect(dialog).not.toContainText("장판");
  await expect(dialog.getByRole("button", { name: "닫기" })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".local/screenshots/related-cost-dialog-390.png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  await page
    .getByRole("button", { name: "내 기록에 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "현도컴퍼니 계정으로 로그인" }),
  ).toBeVisible();
});
