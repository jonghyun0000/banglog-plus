import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Responsibility } from "../src/features/analysis/Responsibility";
import { makeAnalysis } from "../shared/analysis";
import { defaultIntake, type Direction } from "../shared/schema";

for (const direction of [
  "landlord",
  "tenant",
  "mixed",
  "undetermined",
] as Direction[]) {
  test(`responsibility ${direction} never invents percentages or omits either party`, () => {
    const result = makeAnalysis(
      defaultIntake,
      "00000000-0000-4000-8000-000000000001",
      "mock",
      "test",
    );
    result.costResponsibility.direction = direction;
    const html = renderToStaticMarkup(
      createElement(Responsibility, { result, issue: "drain" }),
    );
    expect(html).toContain("임차인 · 세입자");
    expect(html).toContain("임대인 · 집주인");
    expect(html).toContain("책임 비율은 아직 산정할 수 없어요");
    expect(html).not.toMatch(/\d+\s*%/);
    expect(html).toContain("막힌 위치·원인");
    expect(html).toContain(result.costResponsibility.uncertainty);
  });
}
for (const status of ["safety_priority", "out_of_scope"] as const) {
  test(`no responsibility comparison distracts from ${status}`, () => {
    const result = makeAnalysis(
      defaultIntake,
      "00000000-0000-4000-8000-000000000001",
      "mock",
      "test",
    );
    result.status = status;
    expect(
      renderToStaticMarkup(
        createElement(Responsibility, { result, issue: "drain" }),
      ),
    ).toBe("");
  });
}
