import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const registry = JSON.parse(
  readFileSync("data/research/2026-11-05/registry.json", "utf8"),
);
test("private data review separates storage permission from GPT approval on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/admin/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith("/data-governance")
      ? {
          datasets: registry,
          candidates: [
            {
              dataset_id: "data-go-kr-15144809",
              document_type: "consumer_guidance",
              review_status: "pending",
              count: 12,
            },
          ],
          eligibility: {
            versions: 14,
            public_eligible: 0,
            official_general: 3,
          },
        }
      : path.endsWith("/dashboard")
        ? {
            usage: [],
            answers: [],
            operations: [],
            budget: [],
            members: { total: 0, blocked: 0 },
            limits: { calls: 30, tokens: 10000 },
            status: {
              ai: { mode: "mock" },
              database: "connected",
              api: "connected",
            },
          }
        : path.endsWith("/members")
          ? { items: [], total: 0 }
          : path.endsWith("/session")
            ? { authorized: true }
            : [];
    return route.fulfill({ json });
  });
  await page.goto("/admin?manage=1");
  await page
    .getByRole("button", { name: "판례·근거 자료", exact: true })
    .click();
  await expect(
    page.getByText("전문가 검토 승인 0개 · 공식 조문 일반 안내 3개", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByText(
      "민사법 LLM 사전학습 및 Instruction Tuning 데이터 · 원문 저장 보류",
      { exact: true },
    )
    .click();
  await expect(
    page
      .getByText("이용조건 확인 대기 · 외부 AI 이용조건 확인 대기", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/data-governance-mobile.png",
    fullPage: true,
  });
});
