import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { publicDashboardAllowed, releaseVersion } from "../shared/release";
import { createApp } from "../server/routes/app";
import { loadConfig } from "../server/config";
it("release version matches package and public access closes in v2 or when disabled", () => {
  expect(JSON.parse(readFileSync("package.json", "utf8")).version).toBe(
    releaseVersion,
  );
  expect(publicDashboardAllowed()).toBe(true);
  expect(publicDashboardAllowed("2.0.0")).toBe(false);
  expect(publicDashboardAllowed("1.1.0", false)).toBe(false);
});
it("public dashboard kill switch is enforced server side", async () => {
  const { app } = createApp({
    config: loadConfig({ PUBLIC_TEAM_DASHBOARD: "false" }),
  });
  try {
    expect(
      (await app.inject({ method: "GET", url: "/api/public/dashboard" }))
        .statusCode,
    ).toBe(404);
  } finally {
    await app.close();
  }
});
