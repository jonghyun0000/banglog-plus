import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const [width, height] of [
  [360, 640],
  [390, 844],
  [1440, 900],
]) {
  test(`solo leak → request → reply → move-out, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const audit = async (stage: string) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `output/v14/repair-${width}-${stage}.png`,
        fullPage: true,
      });
    };
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") writes.push(r.url());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "수선 요청·퇴실 기록장" }).click();
    await page.getByRole("button", { name: "새 수선 기록 만들기" }).click();
    await page.getByLabel("문제 위치 (같은 위치끼리 비교)").fill("욕실 천장");
    await page
      .getByLabel("최초 발견 시각 (직접 입력)")
      .fill("2026-11-10T09:00");
    await page
      .getByLabel("사용에 지장이 생긴 부분")
      .fill("물이 떨어져 샤워하기 어려움");
    const image = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 40;
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.getByLabel("발견 사진·영상 첨부").setInputFiles({
      name: "leak.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
    await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
    await page
      .getByRole("button", { name: "이 기기에 기록 저장", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "상대방에게 전송된 것은 아니에요",
    );
    await audit("discovery");
    await page.getByRole("button", { name: "2 연락·응답" }).click();
    await page.getByRole("button", { name: "연락·응답 추가" }).click();
    await expect(
      page.getByLabel("실제 전달 시각", { exact: true }),
    ).toHaveValue("");
    await page
      .getByLabel("실제 전달 시각", { exact: true })
      .fill("2026-11-10T10:00");
    await page.getByLabel("전달 채널 (문자·카톡·전화 등)").fill("카톡");
    await page.getByLabel("전달 내용", { exact: true }).fill("누수 점검 요청");
    await page.getByLabel("답변 받은 시각").fill("2026-11-10T11:00");
    await page
      .getByLabel("임대인 답변 (없으면 비워두기)")
      .fill("내일 업체 방문 예정");
    await audit("contact");
    await page.getByRole("button", { name: "3 퇴실·비용" }).click();
    await page.getByLabel("입주 사진이 없어요").check();
    await page
      .getByLabel("기존 하자·입주 상태")
      .fill("입주 시 천장 얼룩 메모 있음");
    await page.getByLabel("퇴실 상태·변화").fill("같은 위치 얼룩 확대");
    await page
      .getByLabel("임대인이 제시한 보증금 공제 사유")
      .fill("도배비 요구");
    await page.getByLabel("영수증 첨부").setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await page
      .getByRole("button", { name: "이 기기에 기록 저장", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("이 기기에 저장");
    await page.reload();
    await page.getByRole("button", { name: "수선 요청·퇴실 기록장" }).click();
    await expect(
      page.getByLabel("저장된 수선 기록").locator("option"),
    ).toHaveCount(2);
    await page
      .getByLabel("저장된 수선 기록")
      .selectOption({ label: "욕실 천장 · 2026-11-10T09:00" });
    await expect(page.getByAltText("leak.png", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "3 퇴실·비용" }).click();
    await expect(page.getByLabel("입주 사진이 없어요")).toBeChecked();
    await expect(
      page.getByRole("link", { name: "파일 내려받기: receipt.pdf" }),
    ).toBeVisible();
    await audit("comparison");
    await page.getByRole("button", { name: "4 기록 요약" }).click();
    await page.getByText("전체 기록 내용 보기", { exact: true }).click();
    await expect(page.locator(".repair-summary")).toContainText(
      "내일 업체 방문 예정",
    );
    await expect(page.locator(".repair-summary")).toContainText(
      "2026-11-10T10:00",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `output/v14/repair-${width}-summary.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "현재 수선 기록 삭제", exact: true })
      .click();
    await page
      .getByRole("button", { name: "수선 기록 삭제 확인", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("첨부파일을 삭제");
    expect(writes).toEqual([]);
  });
}

test("failed local write preserves text and never claims delivery", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "수선 요청·퇴실 기록장" }).click();
  await page.getByRole("button", { name: "새 수선 기록 만들기" }).click();
  await page.getByLabel("문제 위치 (같은 위치끼리 비교)").fill("세탁실");
  await page.getByLabel("발견 사진·영상 첨부").setInputFiles({
    name: "unsafe.html",
    mimeType: "text/html",
    buffer: Buffer.from("<script>bad</script>"),
  });
  await expect(page.getByRole("alert")).toContainText("PDF만 첨부");
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "이 기기에 기록 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("저장하지 못했어요");
  await expect(page.getByLabel("문제 위치 (같은 위치끼리 비교)")).toHaveValue(
    "세탁실",
  );
  await expect(
    page.getByText("아직 저장하지 않은 변경이 있어요."),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
});

test("same-location entry/exit photos and playable video survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "수선 요청·퇴실 기록장" }).click();
  await page.getByRole("button", { name: "새 수선 기록 만들기" }).click();
  await page.getByLabel("문제 위치 (같은 위치끼리 비교)").fill("세탁실 바닥");
  const media = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 80;
    const x = c.getContext("2d")!;
    x.fillStyle = "blue";
    x.fillRect(0, 0, 80, 80);
    const image = c.toDataURL("image/png").split(",")[1];
    const stream = c.captureStream(10);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise<Blob>(
      (resolve) =>
        (rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }))),
    );
    rec.start();
    await new Promise((resolve) => setTimeout(resolve, 300));
    x.fillStyle = "white";
    x.fillRect(20, 20, 30, 30);
    await new Promise((resolve) => setTimeout(resolve, 300));
    rec.stop();
    const blob = await stopped;
    stream.getTracks().forEach((t) => t.stop());
    const video = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.readAsDataURL(blob);
    });
    return { image, video };
  });
  await page.getByLabel("발견 사진·영상 첨부").setInputFiles({
    name: "leak.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(media.video, "base64"),
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "3 퇴실·비용" }).click();
  for (const [label, name] of [
    ["입주 사진 첨부", "entry.png"],
    ["퇴실 사진 첨부", "exit.png"],
  ])
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name,
      mimeType: "image/png",
      buffer: Buffer.from(media.image, "base64"),
    });
  for (const label of ["견적 첨부", "업체 소견 첨부"])
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: label + ".pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await page
    .getByRole("button", { name: "이 기기에 기록 저장", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("이 기기에 저장");
  await page.reload();
  await page.getByRole("button", { name: "수선 요청·퇴실 기록장" }).click();
  await page
    .getByLabel("저장된 수선 기록")
    .selectOption({ label: "세탁실 바닥 · 발견일 미입력" });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "3 퇴실·비용" }).click();
  await expect(page.getByAltText("entry.png", { exact: true })).toBeVisible();
  await expect(page.getByAltText("exit.png", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "현재 수선 기록 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "수선 기록 삭제 확인", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("첨부파일을 삭제");
  const counts = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const req = indexedDB.open("banglog-plus-repair-v1");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["records", "files"], "readonly");
          const records = tx.objectStore("records").count();
          const files = tx.objectStore("files").count();
          tx.oncomplete = () => {
            resolve([records.result, files.result]);
            db.close();
          };
        };
      }),
  );
  expect(counts).toEqual([0, 0]);
});
