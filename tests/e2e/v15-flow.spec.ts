import { test, expect, type Page, type Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeAnalysis } from "../../shared/analysis";

const tap = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();
const approve = (page: Page) =>
  page.locator(".processing-notice").getByRole("checkbox").check();
async function begin(page: Page) {
  await page.goto("/");
  await tap(page, "우리 집 수리 문제 확인하기");
  await page.getByRole("button", { name: "보일러가 고장 났어요" }).click();
  await tap(page, "온수가 나오지 않아요");
  await tap(page, "지금 위험 신호는 없어요");
  await tap(page, "다음");
  await tap(page, "집에 원래 있던 시설이에요");
}

// Keep this multi-session browser flow independent of the suite's IP quota.
async function mockAnalyses(page: Page) {
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 201,
      json: {
        token: "v15-test",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  const posts: Request[] = [];
  await page.route("**/api/analyses", (route) => {
    posts.push(route.request());
    const intake = route.request().postDataJSON().intake;
    const result = makeAnalysis(intake, crypto.randomUUID(), "mock", "test");
    return route.fulfill({ json: result });
  });
  return posts;
}

for (const [width, height] of [
  [360, 640],
  [390, 844],
  [1440, 900],
]) {
  test(`v1.5 local guide flow ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const posts = await mockAnalyses(page);
    const audit = async (name: string) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `output/v15/${width}-${name}.png`,
        fullPage: true,
      });
    };
    await begin(page);
    await expect(page.locator("progress")).toHaveAttribute("max", "3");
    await audit("questions");
    await tap(page, "아직 연락하지 않았어요");
    await expect(page.getByLabel("추가로 설명할 내용")).toBeVisible();
    await page.getByText("발견 기록·계약 특약 (선택)", { exact: true }).click();
    await page.getByLabel("문제 위치 (선택)").fill("욕실");
    await page.getByLabel("발견 시각 (선택)").fill("2026-11-11T08:00");
    await page
      .getByLabel("사용에 지장이 생긴 부분 (선택)")
      .fill("온수 사용 어려움");
    await tap(page, "입력한 내용 확인하기");
    await approve(page);
    await tap(page, "수리 가이드 확인하기");
    await expect(page.locator(".condition-cards details[open]")).toContainText(
      "원인을 모르면",
    );
    await page.getByText("추가로 남겨두면 좋은 사진", { exact: true }).click();
    await expect(
      page.getByText("기기 화면을 정면에서 찍은 사진", { exact: true }),
    ).toBeVisible();
    await page.getByText("기사에게 물어볼 점검 질문", { exact: true }).click();
    await page.getByRole("checkbox", { name: /어떤 원인을 확인했고/ }).check();
    await audit("result");
    await tap(page, "집주인에게 보낼 문구 보기");
    const draft = page.getByLabel("집주인에게 보낼 문구");
    await expect(draft).toHaveValue(/제가 발견한 시각은 2026-11-11 08:00/);
    await draft.fill("첫 요청 문구를 수정했습니다.");
    await tap(page, "점검 후 비용 협의");
    await expect(draft).toHaveValue(/항목별 견적/);
    await draft.fill("수리 범위와 비용을 확인 부탁드립니다.");
    await tap(page, "답변 지연·거절 후 재요청");
    expect(await draft.inputValue()).not.toMatch(/앞서 연락|거절하셨/);
    await tap(page, "첫 수선 요청");
    await expect(draft).toHaveValue("첫 요청 문구를 수정했습니다.");
    await tap(page, "점검 후 비용 협의");
    await expect(draft).toHaveValue("수리 범위와 비용을 확인 부탁드립니다.");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw Error("clipboard blocked");
          },
        },
      }),
    );
    await tap(page, "문구 복사하기");
    await expect(page.getByRole("alert")).toContainText("직접 복사");
    await expect(draft).toBeFocused();
    await audit("message");
    await tap(page, "수선 기록에 이 문구 가져오기");
    await expect(
      page.getByRole("heading", { name: "기록장에 가져올 내용" }),
    ).toBeVisible();
    expect(posts).toHaveLength(1);
    await tap(page, "기록 초안에 가져오기");
    await expect(page.getByLabel("문제 위치 (같은 위치끼리 비교)")).toHaveValue(
      "욕실",
    );
    await expect(
      page.getByRole("button", { name: "이 기기에 기록 저장", exact: true }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
    await tap(page, "이 기기에 기록 저장");
    await expect(page.getByRole("status")).toContainText(
      "이 기기에 저장했어요",
    );
    await tap(page, "2 연락·응답");
    await expect(page.getByLabel("실제 전달 시각")).toHaveCount(0);
    await audit("linked-record");
  });
}

test("technician before contact, hidden answers, and a separately consented follow-up survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAnalyses(page);
  await begin(page);
  await page.getByLabel("수리 기사에게 점검받았나요?").selectOption("yes");
  await tap(page, "비용을 부담하라는 답을 받았어요");
  await tap(page, "노후·시설 또는 건물 문제라는 설명");
  await page
    .getByRole("radio", { name: "점검 기사에게 들었어요", exact: true })
    .check();
  await page
    .getByLabel("기사에게 들은 소견 (선택)")
    .fill("난방 밸브 상태 확인 필요");
  await page.getByText("집주인·관리 담당자 답변 추가", { exact: true }).click();
  await page.getByLabel("상대방 답변 (선택)").fill("이전 가상 답변");
  await tap(page, "뒤로가기");
  await tap(page, "아직 연락하지 않았어요");
  await expect(page.getByLabel("기사에게 들은 소견 (선택)")).toHaveValue(
    "난방 밸브 상태 확인 필요",
  );
  await expect(page.getByLabel("상대방 답변 (선택)")).toHaveCount(0);
  await tap(page, "다음");
  await tap(page, "입력한 내용 확인하기");
  await approve(page);
  const original = page.waitForRequest(
    (r) => r.url().endsWith("/api/analyses") && r.method() === "POST",
  );
  await tap(page, "수리 가이드 확인하기");
  expect((await original).postDataJSON().intake).toMatchObject({
    contact: "no",
    causeSource: "technician",
    otherClaim: "unknown",
    details: { reply: "", technicianNote: "난방 밸브 상태 확인 필요" },
  });
  await tap(page, "이 상황을 수선 기록으로 이어가기");
  await tap(page, "기록 초안에 가져오기");
  await page.getByLabel("문제 위치 (같은 위치끼리 비교)").fill("욕실 보일러");
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await tap(page, "2 연락·응답");
  await tap(page, "연락·응답 추가");
  await expect(page.getByLabel("실제 전달 시각")).toHaveValue("");
  await expect(page.getByLabel("답변 받은 시각")).toHaveValue("");
  await page.getByLabel("실제 전달 시각").fill("2026-11-11T09:30");
  await page.getByLabel("전달 채널 (문자·카톡·전화 등)").fill("문자");
  await page.getByLabel("전달 내용").fill("일지 전용 내용");
  await page.getByLabel("답변 받은 시각").fill("2026-11-11T10:00");
  await page
    .getByLabel("임대인 답변 (없으면 비워두기)")
    .fill("금요일 점검이 가능하다고 답했어요. 010-1234-5678");
  await tap(page, "3 퇴실·비용");
  await page.getByRole("checkbox", { name: /입주 사진이 없어요/ }).check();
  await page
    .getByLabel("항목별 금액 · 출장비·진단비·부품비·공임")
    .fill("비용 기록 전용");
  await tap(page, "이 기기에 기록 저장");
  await expect(page.getByRole("status")).toContainText("이 기기에 저장했어요");
  await page.reload();
  await tap(page, "수선 요청·퇴실 기록장");
  await page.getByLabel("저장된 수선 기록").selectOption({ index: 1 });
  await tap(page, "2 연락·응답");
  await expect(page.getByLabel("실제 전달 시각")).toHaveValue(
    "2026-11-11T09:30",
  );
  await expect(page.getByLabel("답변 받은 시각")).toHaveValue(
    "2026-11-11T10:00",
  );
  await tap(page, "추가 내용으로 다시 안내받기");
  await page
    .getByRole("checkbox", { name: "최근에 기록한 상대방 답변 포함" })
    .check();
  await tap(page, "보낼 내용 확인하기");
  await expect(
    page.getByRole("heading", {
      name: "추가 안내에 보낼 내용을 확인해 주세요",
    }),
  ).toBeVisible();
  await expect(page.locator(".review-list")).toContainText(
    "금요일 점검이 가능하다고 답했어요. [연락처 가림]",
  );
  await expect(
    page.getByRole("button", { name: "수리 가이드 확인하기" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "output/v15/390-followup-review.png",
    fullPage: true,
  });
  const followup = page.waitForRequest(
    (r) => r.url().endsWith("/api/analyses") && r.method() === "POST",
  );
  await approve(page);
  await tap(page, "수리 가이드 확인하기");
  const payload = (await followup).postDataJSON();
  expect(payload.intake.details.reply).toContain("금요일 점검");
  expect(JSON.stringify(payload)).not.toMatch(
    /010-1234-5678|일지 전용|비용 기록 전용|attachments|photos/,
  );
  await tap(page, "이 상황을 수선 기록으로 이어가기");
  await expect(page.getByLabel("추가할 기록")).not.toHaveValue("");
  await tap(page, "기록 초안에 가져오기");
  await page.getByRole("checkbox", { name: /이 기기에 보관/ }).check();
  await tap(page, "이 기기에 기록 저장");
  await expect(page.getByRole("status")).toContainText("이 기기에 저장했어요");
  await expect(page.getByText(/^안내 1 ·/)).toBeVisible();
  await expect(page.getByText(/^안내 2 ·/)).toBeVisible();
  await page.getByText(/^안내 1 ·/).click();
  await expect(
    page
      .getByText(/^안내 1 ·/)
      .locator("..")
      .getByText("사용자가 전한 기사 소견", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/v15/390-guide-history.png",
    fullPage: true,
  });
  await page.reload();
  await tap(page, "수선 요청·퇴실 기록장");
  await page.getByLabel("저장된 수선 기록").selectOption({ index: 1 });
  await expect(page.getByText(/^안내 1 ·/)).toBeVisible();
  await expect(page.getByText(/^안내 2 ·/)).toBeVisible();
});
