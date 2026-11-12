import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeAnalysis } from "../../shared/analysis";

test("English mobile guide preserves the intake and separate language drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 201,
      json: {
        token: "english-test",
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
        "test",
      ),
    }),
  );
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  await page.goto("/");
  await click("Switch to English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Who pays?",
  );
  await click("A light isn’t working");
  await click("It still won’t turn on after replacing the bulb");
  await click("I see smoke or sparks, or smell burning");
  await expect(page.getByRole("alert")).toContainText("Get to safety first");
  await expect(
    page.getByRole("link", { name: "Call 119 in Korea" }),
  ).toHaveAttribute("href", "tel:119");
  await expect(
    page.getByRole("button", { name: "Paused because of a safety hazard" }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await click("No immediate hazards");
  await click("It’s an integrated fixture without a removable bulb");
  await click("Next");
  await click("It came with the rental");
  await click("I haven’t contacted anyone");
  await page
    .getByLabel("Where is the affected light?")
    .fill("Living room ceiling");
  await page.getByLabel("Number of affected lights").fill("1");
  await page.getByLabel("What work was suggested?").selectOption("whole");
  await click("Review my answers");
  await expect(
    page.getByText("Living room ceiling", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /I’ve read this data processing notice/ })
    .check();
  await click("Get repair guidance");
  await expect(
    page.getByRole("heading", { name: "Lighting repair guide", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Report where the lights failed/)).toBeVisible();
  await click("Edit and copy a repair message");
  const draft = page.getByRole("textbox", { name: "Message to copy" });
  await expect(draft).toHaveValue(/Living room ceiling/);
  await expect(draft).toHaveValue(/full replacement is necessary/);
  await draft.fill("Please inspect the living room ceiling light.");
  await click("한국어로 전환");
  await expect(
    page.getByRole("textbox", { name: "집주인에게 보낼 문구" }),
  ).toHaveValue(/Living room ceiling/);
  await click("Switch to English");
  await expect(draft).toHaveValue(
    "Please inspect the living room ceiling light.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
