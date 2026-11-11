import { test, expect } from "@playwright/test";
import { makeFallback } from "../../shared/fallback";
import {
  validatePlan,
  tailoredPlan,
  knowledgeFixture,
} from "../helpers/knowledge";
import { defaultIntake } from "../../shared/schema";
for (const fallback of [false, true]) {
  test(`AI result UI: fallback=${fallback}`, async ({ page }) => {
    const result = fallback
      ? makeFallback(
          defaultIntake,
          "00000000-0000-4000-8000-000000000001",
          "KNOWLEDGE_NOT_FOUND",
        )
      : validatePlan(
          {
            direction: "undetermined",
            explanation:
              "현재 입력만으로 원인을 확정할 수 없어요. 입주 당시 상태와 점검 기록을 함께 확인해 주세요.",
            claimIds: ["maintenance"],
            sourceVersions: [
              {
                sourceId: knowledgeFixture(defaultIntake).passages[0].source.id,
                version:
                  knowledgeFixture(defaultIntake).passages[0].source.version,
              },
            ],
            tailoredResponse: tailoredPlan(),
          },
          defaultIntake,
          "00000000-0000-4000-8000-000000000001",
          "test-model",
        );
    if (!fallback)
      result.aiExplanation =
        "현재 입력만으로 원인을 확정할 수 없어요. 입주 당시 상태와 점검 기록을 함께 확인해 주세요.";
    await page.route("**/api/analyses", (route) => {
      const input = route.request().postDataJSON().intake;
      result.inputVersion = input.inputVersion;
      return route.fulfill({ json: result });
    });
    await page.route("**/api/sessions", (route) =>
      route.fulfill({
        status: 201,
        json: {
          token: "ui-test-session",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "우리 집 수리 문제 확인하기" })
      .click();
    await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
    for (let i = 0; i < 7; i++) {
      if (await page.getByLabel("추가로 설명할 내용").isVisible()) break;
      await page.getByRole("button", { name: "다음", exact: true }).click();
    }
    await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    const responsibility = page.locator(".responsibility");
    await expect(
      responsibility.getByRole("heading", {
        name: "점검 결과에 따라 이렇게 대응해요",
      }),
    ).toBeVisible();
    await expect(responsibility.locator("details")).toHaveCount(3);
    await expect(responsibility.locator("details[open]")).toContainText(
      "지금 할 일",
    );
    await expect(responsibility.locator(".responsibility-ratio")).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await responsibility.screenshot({
      path: `docs/screenshots/responsibility-${fallback ? "fallback" : "ai"}-mobile.png`,
    });
    if (fallback) {
      await expect(
        page.getByText("기본 안내 · AI 분석 아님", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(result.fallback!.notice, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("GPT가 정리한 안내", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "가이드에 대한 의견 남기기" })
        .click();
      await page
        .getByText("화면 문제를 따로 전달하고 싶어요", { exact: true })
        .click();
      await expect(
        page.getByText(`결과 번호: ${result.analysisId}`, { exact: true }),
      ).toBeVisible();
      await page.route("**/api/analyses/*/feedback", (route) =>
        route.fulfill({ status: 204 }),
      );
      await page.getByLabel("잘못된 내용이 있었나요?").selectOption("source");
      await page
        .getByRole("button", { name: "의견 남기기", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "의견을 남겨주셔서 감사해요" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "결과로 돌아가기" }).click();
      await page.screenshot({
        path: "docs/screenshots/pilot-fallback-mobile.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "집주인에게 보낼 문구 보기" })
        .click();
      await expect(
        page.getByText("기본 안내 · 연락 문구", { exact: true }),
      ).toBeVisible();
    } else {
      await page
        .getByText("내 상황에 맞는 다음 대응과 근거", { exact: true })
        .click();
      await expect(
        page.getByText("GPT 맞춤 대응 · DB 근거 연결", { exact: true }),
      ).toBeVisible();
      const guide = page.locator(".tailored-response");
      await expect(guide.getByRole("link").first()).toHaveAttribute(
        "href",
        result.sources[0].url,
      );
      await guide.getByText("출처 확인 정보", { exact: true }).first().click();
      await expect(
        guide.getByText(/전문가 법률 검토: 대기/).first(),
      ).toBeVisible();
      await page.screenshot({
        path: "docs/screenshots/tailored-response-mobile.png",
        fullPage: true,
      });
      await expect(
        page.getByText(result.aiExplanation!, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("기본 안내 · AI 분석 아님", { exact: true }),
      ).toHaveCount(0);
    }
  });
}
