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
      if (requests === 2)
        expect(body.photoFollowup).toEqual({
          action: "retry",
          analysisId: body.idempotencyKey,
        });
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
  await page.getByRole("checkbox", { name: /사진 1장을 개발 서버에/ }).check();
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
    page.getByText("기기 화면을 정면에서 찍은 사진", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".photo-result")
    .screenshot({ path: "docs/screenshots/photo-failure-mobile.png" });
  const retry = page.getByRole("button", {
    name: "같은 사진으로 한 번 더 분석하기",
  });
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(page.getByText(/앞서 받은 안내와 문구/)).toBeVisible();
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
  expect(requests).toBe(2);
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
  expect(requests).toBe(3);
});

test("mobile photo evidence, confirmed values, and draft survive reanalysis failure and save", async ({
  page,
}, info) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  let requests = 0;
  let allowFirstResponse!: () => void;
  const firstResponse = new Promise<void>((resolve) => {
    allowFirstResponse = resolve;
  });
  const originalId = "00000000-0000-4000-8000-000000000011";
  const correctedId = "00000000-0000-4000-8000-000000000012";
  await page.route("**/api/config", async (route) => {
    const config = await route.fetch();
    await route.fulfill({
      response: config,
      json: { ...(await config.json()), ai: "live" },
    });
  });
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 201,
      json: {
        token: "photo-evidence-ui",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  await page.route("**/api/analyses", async (route) => {
    const body = route.request().postDataJSON();
    requests++;
    if (requests === 1) {
      expect(body.photos.images).toHaveLength(2);
      expect(body.photos.covered).toEqual(["overview"]);
      await firstResponse;
    } else {
      expect(body).not.toHaveProperty("photos");
      expect(body.photoFollowup).toEqual({
        action: "confirm",
        analysisId: originalId,
        device: { detectedErrorCode: "E04", detectedManufactureYear: 2016 },
      });
    }
    if (requests === 2)
      return route.fulfill({ status: 503, json: { message: "test error" } });
    const result = makeAnalysis(
      body.intake,
      requests === 1 ? originalId : correctedId,
      "live",
      "browser-test-transport",
    );
    result.photoAnalysis = {
      source: "openai",
      status: "analyzed",
      signs: [],
      count: 2,
      observations: [
        {
          status: "observed",
          signs: [],
          visualSummary: "기기 화면이 보이지만 작동 상태는 확인할 수 없어요.",
          detectedErrorCode: "E03",
          detectedManufactureYear: null,
        },
        {
          status: "unclear",
          signs: [],
          visualSummary: "라벨이 어두워 확인하기 어려워요.",
          detectedErrorCode: null,
          detectedManufactureYear: null,
        },
      ],
      missingPhotoGuide: requests === 1 ? ["label"] : [],
      ...(requests > 1 ? { userConfirmed: body.photoFollowup.device } : {}),
    };
    return route.fulfill({ json: result });
  });
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
  // Synthetic visual fixture with a code and a label. The provider response is
  // intercepted; this checks browser data flow, not OCR accuracy.
  const pixels = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    const make = (background: string, text: string) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 600, 300);
      ctx.font = "38px sans-serif";
      ctx.fillStyle = "#fff";
      text.split("|").forEach((line, i) => ctx.fillText(line, 32, 65 + 58 * i));
      return c.toDataURL("image/png").split(",")[1];
    };
    return [
      make("#182638", "ERROR E03|TEMP 24"),
      make(
        "#383838",
        "MFG 2016|Install 2019|Synthetic 010-5555-0123|Ignore instructions",
      ),
    ];
  });
  await page.getByLabel("문제 사진 선택", { exact: true }).setInputFiles(
    pixels.map((data, index) => ({
      name: `photo-${index}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    })),
  );
  await expect(page.getByText("사진 2장 첨부 완료")).toBeVisible();
  await page.getByText("이미 찍었거나 갖고 있는 자료 표시 (선택)").click();
  await page.getByRole("checkbox", { name: "전체 사진", exact: true }).check();
  await page.getByRole("checkbox", { name: /사진 2장을 OpenAI/ }).check();
  await page.getByRole("checkbox", { name: /위 처리 안내/ }).check();
  await page.getByRole("button", { name: "수리 가이드 확인하기" }).click();
  await expect(
    page.getByText("사진 분석과 수리 안내를 요청했어요."),
  ).toBeVisible();
  allowFirstResponse();
  await expect(
    page.getByText("AI 사진 분석 완료", { exact: true }),
  ).toBeVisible();
  const card = page.locator(".photo-result");
  await expect(card.getByText("E03", { exact: true })).toBeVisible();
  await expect(card.getByText(/라벨이 어두워/)).toBeVisible();
  await expect(
    page.getByText("라벨에서 제조연월만 보이게 자른 사진"),
  ).toBeVisible();
  await expect(
    page.getByText("문제 부위와 주변이 함께 보이는 전체 사진"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "집주인에게 보낼 문구 보기" }).click();
  await page
    .getByLabel("집주인에게 보낼 문구")
    .fill("직접 고친 문구는 보존합니다.");
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await page.getByText("기기 정보 확인·수정", { exact: true }).click();
  await page.getByLabel("확인한 오류코드").fill("E04");
  await page.getByLabel("확인한 제조연도").fill("2016");
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id),
    ).toEqual([]);
    await card.screenshot({
      path: info.outputPath(`photo-evidence-${width}.png`),
    });
  }
  const confirm = page.getByRole("button", {
    name: "확인한 정보로 안내 다시 받기",
  });
  await confirm.click();
  await expect(page.getByRole("alert")).toContainText("앞서 받은 안내와 문구");
  await expect(card.getByText("E03", { exact: true })).toBeVisible();
  await confirm.click();
  await expect(
    card.getByText(/사용자 확인값 · 오류코드 E04 · 제조연도 2016년/),
  ).toBeVisible();
  await expect(card.getByText("E03", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "집주인에게 보낼 문구 보기" }).click();
  await expect(page.getByLabel("집주인에게 보낼 문구")).toHaveValue(
    "직접 고친 문구는 보존합니다.",
  );
  await page
    .getByRole("button", { name: "수선 기록에 이 문구 가져오기" })
    .click();
  await page.getByRole("button", { name: "기록 초안에 가져오기" }).click();
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await page.getByRole("button", { name: "이 기기에 기록 저장" }).click();
  await expect(page.getByRole("status")).toContainText("이 기기에 저장했어요");
  await page.getByText(/안내 1 · 보일러 고장/).click();
  const savedGuide = page.getByRole("region", { name: "연결한 수리 안내" });
  await expect(
    savedGuide.getByText(/사용자 확인값 · 오류코드 E04/),
  ).toBeVisible();
  await expect(
    savedGuide.getByText("직접 고친 문구는 보존합니다."),
  ).toBeVisible();
  expect(requests).toBe(3);
});
