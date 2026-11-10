import { test, expect } from "@playwright/test";
import { makeAnalysis } from "../../shared/analysis";
for (const manager of ["yes", "no"] as const)
  test(`building selection and recipient draft: manager=${manager}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      (window as unknown as { kakao: unknown }).kakao = {
        Postcode: class {
          complete: (data: unknown) => void;
          constructor(options: { oncomplete: (data: unknown) => void }) {
            this.complete = options.oncomplete;
          }
          embed(el: HTMLElement, options: { q: string }) {
            el.replaceChildren();
            el.dataset.query = options.q;
            const b = document.createElement("button");
            b.textContent = "테스트 주소 선택";
            b.onclick = () =>
              this.complete({
                bcode: "1168010300",
                jibunAddress: "서울특별시 강남구 개포동 12",
                roadAddress: "테스트 주소",
              });
            el.append(b);
          }
        },
      };
    });
    const sample = {
      id: "1",
      label: "101동",
      use: "공동주택",
      structure: "철근콘크리트구조",
      approval: "19921014",
      floors: 15,
      checkedAt: "2026-11-05T00:00:00.000Z",
      repairHistory: "unknown",
      manager: "unknown",
    };
    await page.route("**/api/buildings", (r) =>
      r.fulfill({ json: { total: 1, page: 1, items: [sample] } }),
    );
    await page.route("**/api/sessions", (r) =>
      r.fulfill({ status: 201, json: { token: "test-building" } }),
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
    for (const name of [
      "우리 집 수리 문제 확인하기",
      "배수가 안 돼요",
      "물이 천천히 내려가요",
      "세면대",
      "이곳 한 군데만 그래요",
      "넘치거나 주변으로 새지는 않아요",
      "지금 위험 신호는 없어요",
      "배수구 약품은 넣지 않았어요",
      "아직 해본 조치는 없어요",
    ])
      await page
        .getByRole("button", { name, exact: name !== "배수가 안 돼요" })
        .click();
    await page
      .getByRole("radio", { name: "입주 후 처음 생겼어요", exact: true })
      .check();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page
      .getByRole("button", { name: "아직 연락하지 않았어요", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "주소 검색하기", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("주소 직접 입력", { exact: true })
      .fill("춘천시 한림대학길 1");
    await page
      .getByRole("button", { name: "주소 검색하기", exact: true })
      .click();
    await expect(
      page.locator('[data-query="춘천시 한림대학길 1"]'),
    ).toBeVisible();
    await page.getByLabel("주소 직접 입력", { exact: true }).fill("역삼동 737");
    await page.getByLabel("주소 직접 입력", { exact: true }).press("Enter");
    await expect(page.locator('[data-query="역삼동 737"]')).toBeVisible();
    await page
      .getByRole("button", { name: "테스트 주소 선택", exact: true })
      .click();
    await page.getByRole("button", { name: /101동/ }).click();
    await page.getByLabel("주소 직접 입력", { exact: true }).fill("개포동 12");
    await expect(
      page.getByText("선택한 건축물대장 정보", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "주소 검색하기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "테스트 주소 선택", exact: true })
      .click();
    await page.getByRole("button", { name: /101동/ }).click();
    await expect(
      page.getByText("사용승인 후 20년 이상", { exact: false }),
    ).toBeVisible();
    await page.getByRole("combobox").first().selectOption("yes");
    await page.getByRole("combobox").last().selectOption(manager);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/building-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "입력한 내용 확인하기", exact: true })
      .click();
    await expect(page.locator(".review-list")).toContainText("19921014");
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/api/analyses") && r.method() === "POST",
    );
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
    const payload = (await request).postDataJSON();
    await expect(
      page.getByRole("region", { name: "수리 이력과 연락 순서" }),
    ).toContainText("수리 이력은 원인을 확인하는 자료");
    await expect(
      page.getByRole("region", { name: "수리 이력과 연락 순서" }),
    ).toContainText(
      manager === "yes"
        ? "연락할 관리 담당자에게 점검"
        : "알고 있는 담당자가 없으면 집주인에게",
    );
    await page.screenshot({
      path: ".local/building-guide-mobile.png",
      fullPage: true,
    });
    expect(payload.intake.building.repairHistory).toBe("yes");
    expect(JSON.stringify(payload)).not.toContain("테스트 주소");
    expect(JSON.stringify(payload)).not.toContain("역삼동 737");
    await expect(
      page.getByRole("heading", { name: "지금은 이렇게 시작해요" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name:
          manager === "yes"
            ? "관리 담당자에게 보낼 문구 보기"
            : "집주인에게 보낼 문구 보기",
      })
      .click();
    const text = await page.locator("textarea").first().inputValue();
    expect(text).toContain("알고 있는 내용을 함께 전달");
    expect(text.includes("관리 담당자님")).toBe(manager === "yes");
    expect(text).toContain(
      manager === "yes" ? "집주인과도 공유" : "방문 일정을 안내",
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.documentElement.dataset.copiedDraft = value;
          },
        },
      });
    });
    await page.getByRole("button", { name: "문구 복사하기" }).click();
    expect(
      await page.evaluate(() => document.documentElement.dataset.copiedDraft),
    ).toBe(text);
  });
