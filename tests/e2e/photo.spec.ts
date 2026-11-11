import { test, expect } from "@playwright/test";
import { makeAnalysis } from "../../shared/analysis";

test("mobile optional photos: preview, consent, delete, failure fallback and retry without photo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  await page.route("**/api/sessions", (r) =>
    r.fulfill({
      status: 201,
      json: {
        token: "photo-ui-test",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  await page.route("**/api/analyses", async (route) => {
    const body = route.request().postDataJSON();
    requests++;
    const result = makeAnalysis(
      body.intake,
      "00000000-0000-4000-8000-000000000001",
      "mock",
      "test",
    );
    if (body.photos) {
      expect(body.photos.consent).toBe(true);
      expect(body.photos.images[0]).toMatch(/^data:image\/jpeg;base64,/);
      expect(body.intake).not.toHaveProperty("photos");
      result.photoAnalysis = { status: "failed", signs: [], count: 1 };
    }
    await route.fulfill({ json: result });
  });
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
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const x = c.getContext("2d")!;
    x.fillStyle = "#888";
    x.fillRect(0, 0, 24, 24);
    return c.toDataURL("image/png").split(",")[1];
  });
  const file = {
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
  const upload = page.getByLabel("문제 사진 선택", { exact: true });
  await upload.setInputFiles(file);
  await expect(page.getByAltText("첨부한 문제 사진 1")).toBeVisible();
  await page.getByRole("checkbox", { name: /위 처리 안내/ }).check();
  await expect(
    page.getByRole("button", { name: "수리 가이드 확인하기" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /사진 1장을 OpenAI/ }).check();
  await page
    .locator(".photo-upload")
    .screenshot({ path: "docs/screenshots/photo-upload-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByText("사진 분석에 실패해 선택한 답변으로 안내했어요."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "내 기록에 저장", exact: true }),
  ).toBeVisible();
  await page.getByText("추가로 남겨두면 좋은 사진", { exact: true }).click();
  await expect(
    page.getByText("실내 조절기 오류 코드", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".photo-result")
    .screenshot({ path: "docs/screenshots/photo-failure-mobile.png" });
  await page
    .getByRole("button", { name: "이 상황을 수선 기록으로 이어가기" })
    .click();
  const attachCopy = page.getByRole("checkbox", {
    name: /분석에 쓴 사진 1장도/,
  });
  await expect(attachCopy).not.toBeChecked();
  await attachCopy.check();
  await page.getByRole("button", { name: "기록 초안에 가져오기" }).click();
  await expect(
    page.getByRole("link", { name: /파일 내려받기: 분석에 사용한 사진/ }),
  ).toBeVisible();
  const save = page.getByRole("button", {
    name: "이 기기에 기록 저장",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await save.click();
  await expect(page.getByRole("status")).toContainText("이 기기에 저장했어요");
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await page.getByText("입력한 내용 보기", { exact: true }).click();
  await page
    .getByRole("button", { name: "입력 수정하고 다시 확인하기" })
    .click();
  // Result edit returns to question flow; use browser back to review if needed.
  for (let i = 0; i < 8; i++) {
    if (
      await page
        .getByRole("button", { name: "입력한 내용 확인하기" })
        .isVisible()
    ) {
      await page.getByRole("button", { name: "입력한 내용 확인하기" }).click();
      break;
    }
    if (await upload.isVisible()) break;
    await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  await page.getByRole("button", { name: "사진 1 삭제", exact: true }).click();
  await expect(page.getByAltText("첨부한 문제 사진 1")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /위 처리 안내/ }).check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(page.locator(".result-screen .photo-result")).toHaveCount(0);
  expect(requests).toBe(2);
});
