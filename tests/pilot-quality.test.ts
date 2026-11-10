import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { defaultIntake } from "../shared/schema.js";
import { makeFallback } from "../shared/fallback.js";
import {
  knowledgeFixture,
  tailoredPlan,
  validatePlan,
} from "./helpers/knowledge.js";
const knowledge = knowledgeFixture(defaultIntake);
const source = knowledge.passages[0].source;
const base = {
  direction: "undetermined",
  explanation:
    "현재 입력만으로 원인을 확정할 수 없어요. 점검 기록을 확인해 주세요.",
  claimIds: ["maintenance"],
  sourceVersions: [{ sourceId: source.id, version: source.version }],
};
it.each([
  "청소로 해결되지 않았으므로 배관 문제입니다.",
  "입주 후 발생했으니 세입자 과실입니다.",
  "집주인이 전액 부담해야 합니다.",
  "협의가 될 때까지 월세를 지급하지 마세요.",
  "문제가 계속되면 보일러를 분해하세요.",
  "막힘이 해결되지 않으면 락스와 약품을 섞으세요.",
])("rejects unsupported or unsafe prose: %s", (explanation) => {
  expect(() =>
    validatePlan({ ...base, explanation }, defaultIntake, randomUUID(), "test"),
  ).toThrow();
  const tailoredResponse = tailoredPlan();
  tailoredResponse.steps[0].action = explanation;
  expect(() =>
    validatePlan(
      { ...base, tailoredResponse },
      defaultIntake,
      randomUUID(),
      "test",
    ),
  ).toThrow();
});
it("allows uncertainty and an inspection request", () => {
  expect(
    validatePlan(
      { ...base, tailoredResponse: tailoredPlan() },
      defaultIntake,
      randomUUID(),
      "test",
    ).aiExplanation,
  ).toBe(base.explanation);
});
it("rejects repeated source versions", () => {
  expect(() =>
    validatePlan(
      {
        ...base,
        sourceVersions: [base.sourceVersions[0], base.sourceVersions[0]],
      },
      defaultIntake,
      randomUUID(),
      "test",
    ),
  ).toThrow();
});
it("distinguishes missing evidence from a provider outage", () => {
  const missing = makeFallback(
    defaultIntake,
    randomUUID(),
    "KNOWLEDGE_NOT_FOUND",
  );
  const outage = makeFallback(defaultIntake, randomUUID(), "PROVIDER_TIMEOUT");
  expect(missing.fallback?.notice).toContain("근거 자료");
  expect(outage.fallback?.notice).toContain("AI 분석을 완료하지 못해");
  for (const result of [missing, outage]) {
    expect(result.sources).toEqual([]);
    expect(result.costResponsibility.direction).toBe("undetermined");
  }
});
