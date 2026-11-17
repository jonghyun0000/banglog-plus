import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeAnalysis } from "../../shared/analysis";
import { knowledgeFixture } from "../helpers/knowledge";
import { makeFallback } from "../../shared/fallback";

for (const fallback of [true, false])
  test(`English mobile guide preserves answers and separate language drafts (fallback=${fallback})`, async ({
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
    await page.route("**/api/analyses", (route) => {
      const request = route.request().postDataJSON();
      expect(request.responseLanguage).toBe("en");
      const id = "00000000-0000-4000-8000-000000000001";
      const result = fallback
        ? makeFallback(request.intake, id, "PROVIDER_TIMEOUT")
        : makeAnalysis(request.intake, id, "live", "test");
      if (!fallback) {
        const { source, claim } = knowledgeFixture(request.intake).passages[0];
        result.sources = [source];
        result.aiExplanation =
          "A fixture inspection can help narrow down the cause of the outage.";
        result.tailoredResponse = {
          summary:
            "The light stayed off after a bulb change. An inspection is the next step.",
          steps: [
            "Request a fixture inspection",
            "Ask about the work needed",
          ].map((title) => ({
            title,
            action:
              "Ask your landlord for a written inspection and the scope of any proposed work.",
            reason:
              "The source supports checking the condition of the fixture before discussing costs.",
            factKeys: ["contact"],
            missingEvidence: ["Inspection findings"],
            citations: [
              {
                sourceId: source.id,
                sourceVersion: source.version,
                location: source.location,
                claim,
              },
            ],
          })),
        };
      }
      return route.fulfill({ json: { ...result, responseLanguage: "en" } });
    });
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
    await page
      .getByLabel("Describe any other safety concern")
      .fill("Sparks are coming from a socket");
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
    await expect(
      page.getByText(/Report where the lights failed/),
    ).toBeVisible();
    if (fallback) {
      await expect(
        page.getByText(/GPT couldn’t complete this request/),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "GPT guidance based on verified sources",
        }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("heading", {
          name: "GPT guidance based on verified sources",
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Legal basis and limits").first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Read the Korean original/ }).first(),
      ).toHaveAttribute("href", /^https:\/\//);
    }
    await expect(
      page.getByRole("group", { name: "Key takeaways" }),
    ).toContainText("Check whether the bulb is the issue");
    const cta = page.getByRole("button", {
      name: "View message to your landlord",
    });
    await expect(cta).toBeInViewport();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await cta.click();
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
