import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { english } from "../../src/app/english";
import { makeAnalysis } from "../../shared/analysis";
import type { Intake } from "../../shared/schema";

for (const lang of ["ko", "en"] as const) {
  test(`single bulb shortcuts optional timing while keeping safety and review (${lang})`, async ({
    page,
  }) => {
    const t = (text: string) =>
      lang === "en" ? (english[text] ?? text) : text;
    const click = (text: string) =>
      page.getByRole("button", { name: t(text), exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    let submissions = 0;
    let sessions = 0;
    await page.route("**/api/sessions", (route) => {
      sessions++;
      return route.fulfill({
        status: 201,
        json: { token: "single-bulb-test" },
      });
    });
    await page.route("**/api/analyses", (route) => {
      submissions++;
      const { intake, responseLanguage } = route.request().postDataJSON() as {
        intake: Intake;
        responseLanguage: string;
      };
      expect(responseLanguage).toBe(lang);
      expect(intake).toMatchObject({
        safety: "none",
        lighting: "replaceable",
        discovered: "today",
        preexisting: "unknown",
        contact: "no",
      });
      return route.fulfill({
        json: makeAnalysis(
          intake,
          "00000000-0000-4000-8000-000000000001",
          "mock",
          "test",
        ),
      });
    });
    await page.goto(`/?lang=${lang}`);
    await click("전구가 고장났어요");
    await click("전구 한 개가 켜지지 않아요");
    await click("연기·불꽃·타는 냄새가 나요");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: t("위험 신호가 있어 진행을 중단했어요"),
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("link", { name: t("119에 전화하기") }),
    ).toHaveAttribute("href", "tel:119");
    await click("지금 위험 신호는 없어요");
    await expect(page.locator(".question-context")).toContainText(
      t("증상·안전"),
    );
    await click("전구·형광등만 바꿀 수 있어요");
    await expect(
      page.getByText(t("지금 확인할 것"), { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".question-context")).toContainText(
      t("상황 확인"),
    );
    await expect(
      page.getByRole("group", { name: t("처음 발견한 시점") }),
    ).toHaveCount(0);
    await click("집에 원래 있던 시설이에요");
    await click("아직 연락하지 않았어요");
    await expect(page.locator(".question-context")).toContainText(
      t("자료·검토"),
    );
    await expect(
      page.getByText(t("발견 시점·입주 당시 상태 (선택)")),
    ).toBeVisible();
    await click("입력한 내용 확인하기");
    expect(sessions).toBe(0);
    expect(submissions).toBe(0);
    await page
      .getByRole("button", {
        name: lang === "en" ? `Edit ${t("발견 시점")}` : "발견 시점 수정",
      })
      .click();
    await page.getByRole("radio", { name: t("오늘 발견했어요") }).check();
    await click("입력한 내용 확인하기");
    const consent = page.getByRole("checkbox", {
      name:
        lang === "en"
          ? /I’ve read this data processing notice/
          : /위 처리 안내를 확인했어요/,
    });
    await expect(consent).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: t("수리 가이드 확인하기") }),
    ).toBeDisabled();
    await consent.check();
    await click("수리 가이드 확인하기");
    await expect(
      page.getByRole("group", { name: t("핵심 요약") }),
    ).toContainText(t("전구 자체 문제인지 등기구 점검이 필요한지 확인해요."));
    expect(submissions).toBe(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const message =
      lang === "en"
        ? "View message to your landlord"
        : "집주인에게 보낼 문구 보기";
    await expect(
      page.getByRole("button", { name: message, exact: true }),
    ).toBeInViewport();
    await click(message);
    await expect(
      page.getByRole("textbox", {
        name: lang === "en" ? "Message to copy" : "집주인에게 보낼 문구",
      }),
    ).toBeVisible();
  });
}
