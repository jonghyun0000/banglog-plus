import { test, expect, type Page } from "@playwright/test";
import { makeAnalysis } from "../../shared/analysis";
async function start(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sessions", (r) =>
    r.fulfill({
      status: 201,
      json: {
        token: "drain-ui-test",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
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
}
async function select(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function finish(page: Page) {
  await page
    .getByRole("radio", { name: "입주 후 처음 생겼어요", exact: true })
    .check();
  await select(page, "다음");
  await select(page, "아직 연락하지 않았어요");
  await select(page, "입력한 내용 확인하기");
  await page.getByRole("checkbox").check();
  await select(page, "수리 가이드 확인하기");
  await expect(page.locator(".drain-guide")).toBeVisible();
}
test("drain: safe sink route, back navigation, input preservation, self-care before contact", async ({
  page,
}) => {
  await start(page);
  await select(page, "물이 천천히 내려가요");
  await select(page, "지금 위험 신호는 없어요");
  await select(page, "세면대");
  await select(page, "이곳 한 군데만 그래요");
  await select(page, "넘치거나 주변으로 새지는 않아요");
  await select(page, "배수구 약품은 넣지 않았어요");
  await expect(
    page.getByRole("heading", { name: "이미 해본 조치가 있나요?" }),
  ).toBeVisible();
  await select(page, "뒤로가기");
  await expect(
    page.getByRole("heading", { name: "배수구에 약품을 넣었나요?" }),
  ).toBeVisible();
  await select(page, "배수구 약품은 넣지 않았어요");
  await select(page, "아직 해본 조치는 없어요");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/analyses") && r.method() === "POST",
  );
  await finish(page);
  expect((await request).postDataJSON().intake.drain).toMatchObject({
    location: "basin",
    scope: "single",
    chemical: "no",
    attempted: "none",
  });
  await expect(page.locator(".drain-guide")).toContainText(
    "눈에 보이는 이물질부터",
  );
  await expect(page.locator(".drain-guide")).toContainText("그대로라면 집주인");
  const overview = page.locator(".result-overview");
  await expect(
    overview.getByText("눈에 보이는 이물질부터 확인해요", { exact: true }),
  ).toBeInViewport();
  await expect(
    overview.getByText("분해 없이 거름망 표면만 확인하세요.", { exact: true }),
  ).toBeInViewport();
  const examples = page.getByRole("region", { name: "비슷한 수리 비용 사례" });
  const preview = overview.getByRole("link", { name: /1건 보기/ });
  await expect(preview).toContainText("10만 원");
  await expect(preview).toBeInViewport();
  await page.screenshot({ path: ".local/repair-cost-overview.png" });
  await expect(examples).toContainText("세면대 트랩 청소와 배수 마개 교체");
  await expect(examples).toContainText("업체 공개 예산");
  await expect(examples).toContainText("100,000원");
  await expect(examples).toContainText(
    "실제 결제액과 누가 냈는지는 확인되지 않았어요",
  );
  const similar = examples.getByRole("list", { name: "비슷한 수리비 자료" });
  await expect(similar).not.toContainText("연결 배관 청소");
  await expect(examples.getByRole("listitem")).toHaveCount(1);
  await expect(examples).not.toContainText("싱크대 배관 막힘 제거");
  await expect(examples.getByRole("button", { name: /더 보기/ })).toHaveCount(
    0,
  );
  await expect(
    examples.getByRole("link", { name: /세면대.*숨고 원문/ }),
  ).toHaveAttribute("href", /^https:\/\/soomgo\.com\/portfolio\/detail\//);
  expect(
    await examples.evaluate((section) =>
      Boolean(
        section.compareDocumentPosition(
          document.querySelector(".drain-guide")!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  await preview.click();
  await expect(examples.getByRole("heading", { level: 2 })).toBeFocused();
  await page.screenshot({ path: ".local/repair-cost-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/drain-safe-mobile.png",
    fullPage: true,
  });
  await select(page, "집주인에게 보낼 문구 보기");
  await expect(page.locator(".drain-guide")).toContainText(
    "눈에 보이는 이물질부터",
  );
});
test("drain: chemical route skips tool questions and back navigation follows the active branch", async ({
  page,
}) => {
  await start(page);
  await select(page, "물이 잘 내려가지 않아요");
  await select(page, "지금 위험 신호는 없어요");
  await select(page, "세면대");
  await select(page, "이곳 한 군데만 그래요");
  await select(page, "넘치거나 주변으로 새지는 않아요");
  await select(page, "배수구 약품을 넣었어요");
  await expect(
    page.getByRole("heading", { name: "언제부터 있었던 문제인가요?" }),
  ).toBeVisible();
  await select(page, "뒤로가기");
  await expect(
    page.getByRole("heading", { name: "배수구에 약품을 넣었나요?" }),
  ).toBeVisible();
  await select(page, "배수구 약품을 넣었어요");
  await finish(page);
  await expect(page.locator(".drain-guide")).toContainText(
    "약품을 더 넣거나 도구를 쓰지 마세요",
  );
  await expect(page.locator(".drain-guide")).not.toContainText(
    "컵형 압축기를 제품 설명대로",
  );
  await page.screenshot({
    path: "docs/screenshots/drain-chemical-mobile.png",
    fullPage: true,
  });
});
test("drain: multiple backflow skips DIY and prioritizes stopping water", async ({
  page,
}) => {
  await start(page);
  await select(page, "물이 역류해요");
  await select(page, "지금 위험 신호는 없어요");
  await select(page, "욕실 바닥 배수구");
  await select(page, "여러 배수구가 함께 그래요");
  await select(page, "물이 넘치거나 주변으로 새고 있어요");
  await select(page, "배수구 약품은 넣지 않았어요");
  await expect(
    page.getByRole("heading", { name: "언제부터 있었던 문제인가요?" }),
  ).toBeVisible();
  await finish(page);
  await expect(page.locator(".drain-guide")).toContainText("물 사용을 멈추고");
  const overview = page.locator(".result-overview");
  await expect(
    overview.getByText("물 사용을 멈추고 점검을 요청해요", { exact: true }),
  ).toBeInViewport();
  await expect(overview.locator('a[href="#repair-cost-title"]')).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "비슷한 수리 비용 사례" }),
  ).toHaveCount(0);
  await expect(page.locator(".drain-guide")).not.toContainText(
    "거름망 표면의 이물질만 제거",
  );
});
