import { validatePlan } from "../server/ai/provider";
import { it, expect } from "vitest";
import {
  defaultIntake,
  defaultDrain,
  intakeSchema,
  analysisSchema,
  type Intake,
} from "../shared/schema";
import {
  questionSteps,
  adjacentQuestion,
  drainGuide,
  drainFacts,
} from "../shared/drain";
import { makeAnalysis } from "../shared/analysis";
import { makeFallback } from "../shared/fallback";
import { tailoredPlan, knowledgeFixture } from "./helpers/knowledge";
const input: Intake = {
  ...defaultIntake,
  issue: "drain",
  observation: "slow-drain",
  preexisting: "no",
  safety: "none",
  drain: {
    ...defaultDrain,
    location: "basin",
    scope: "single",
    overflow: "no",
    chemical: "no",
    attempted: "none",
  },
};
it("drain branching preserves normal flow and uses the just-selected answer", () => {
  expect(questionSteps(defaultIntake)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(adjacentQuestion(input, 0, 1)).toBe(7);
  expect(adjacentQuestion(input, 10, 1)).toBe(11);
  const chemical = {
    ...input,
    drain: { ...input.drain!, chemical: "yes" as const },
  };
  expect(adjacentQuestion(chemical, 10, 1)).toBe(1);
  expect(adjacentQuestion(chemical, 1, -1)).toBe(10);
  expect(questionSteps({ ...input, contact: "cost" })).toContain(3);
  expect(questionSteps(input)).not.toContain(3);
  expect(questionSteps({ ...input, observation: "backflow" })).not.toContain(
    11,
  );
});
it("safe local blockage starts with surface cleaning and then conditional contact", () => {
  const g = drainGuide(input)!;
  expect(g.route).toBe("self_check");
  expect(g.steps[0].body).toContain("거름망");
  expect(g.steps[1].title).toContain("그대로라면");
  const cleaned = drainGuide({
    ...input,
    drain: { ...input.drain!, attempted: "cleaned" },
  })!;
  expect(cleaned.steps[0].title).toContain("반복하지");
  expect(cleaned.steps[0].body).toContain("점검을 요청");
});
it.each([
  { drain: { ...input.drain!, chemical: "yes" } },
  { drain: { ...input.drain!, chemical: "unknown" } },
  { drain: { ...input.drain!, attempted: "tool" } },
  { drain: { ...input.drain!, attempted: "professional" } },
  { drain: { ...input.drain!, scope: "unknown" } },
  { drain: { ...input.drain!, location: "toilet" } },
  { preexisting: "yes" },
  { preexisting: "unknown" },
  { description: "세정제를 사용했어요" },
  { safety: "unknown" },
])("uncertain or attempted situations do not enable DIY: %j", (patch) => {
  expect(drainGuide({ ...input, ...patch } as Intake)?.route).toBe("contact");
});
it.each([
  { observation: "backflow" },
  { drain: { ...input.drain!, scope: "multiple" } },
  { drain: { ...input.drain!, overflow: "yes" } },
])("overflow and multiple clogs skip DIY: %j", (patch) => {
  const i = { ...input, ...patch } as Intake;
  expect(drainGuide(i)?.route).toBe("stop");
  expect(questionSteps(i)).not.toContain(11);
});
it("danger and out-of-scope never show self-care; legacy and non-drain records still parse", () => {
  expect(drainGuide({ ...input, safety: "electric" })).toBeUndefined();
  expect(intakeSchema.parse({ ...defaultIntake })).not.toHaveProperty("drain");
  expect(
    makeAnalysis(
      { ...input, description: "보증금 반환 소송" },
      crypto.randomUUID(),
      "mock",
      "test",
    ).drainGuide,
  ).toBeUndefined();
  expect(
    makeAnalysis(defaultIntake, crypto.randomUUID(), "mock", "test").drainGuide,
  ).toBeUndefined();
});
it("drain care, provenance and fallback survive result serialization", () => {
  const r = makeAnalysis(input, crypto.randomUUID(), "mock", "test");
  expect(
    r.userReportedFacts.find((f) => f.key === "drain.chemical")?.value,
  ).toContain("넣지 않았");
  expect(
    analysisSchema.parse(JSON.parse(JSON.stringify(r))).drainGuide,
  ).toEqual(r.drainGuide);
  expect(
    makeFallback(input, crypto.randomUUID(), "PROVIDER_TIMEOUT").nextActions,
  ).toEqual(r.nextActions);
});
it("GPT cannot replace safe-care instructions with its own tool advice", () => {
  const k = knowledgeFixture(input);
  const source = k.passages.find((p) => p.claimId === "maintenance")!.source;
  const p = {
    direction: "undetermined",
    claimIds: ["maintenance"],
    sourceVersions: [{ sourceId: source.id, version: source.version }],
    tailoredResponse: tailoredPlan(),
  };
  const result = validatePlan(p, input, crypto.randomUUID(), "test", k);
  expect(result.nextActions).toEqual(
    result.drainGuide?.steps.map((s) => s.body),
  );
  const factsOnly = {
    ...p,
    explanation:
      "현재 약품은 사용하지 않았다는 사용자 진술이 있어요. 이미 표면 청소를 했지만 해결되지 않았으며 실제 원인은 확인이 필요해요.",
  };
  expect(
    validatePlan(factsOnly, input, crypto.randomUUID(), "test", k)
      .aiExplanation,
  ).toContain("약품은 사용하지 않았");
  p.tailoredResponse.steps[0].action =
    "압축기를 사용해서 배수구를 직접 뚫어보세요.";
  expect(() => validatePlan(p, input, crypto.randomUUID(), "test", k)).toThrow(
    "PROVIDER_OUTPUT",
  );
});

it("v1.2 custom location is bounded, masked, retained and never enables DIY", async () => {
  const { sanitizeIntake, hasDanger } = await import("../shared/safety");
  const custom = intakeSchema.parse({
    ...input,
    drain: {
      ...input.drain,
      location: "other",
      locationDetail: "베란다 배수구 010-1234-5678",
    },
  });
  const clean = sanitizeIntake(custom);
  expect(clean.drain?.locationDetail).toBe("베란다 배수구 [연락처 가림]");
  expect(drainFacts(clean)[0].value).toContain("베란다 배수구");
  expect(drainGuide(clean)?.route).toBe("contact");
  expect(
    intakeSchema.safeParse({
      ...custom,
      drain: { ...custom.drain, locationDetail: "a".repeat(81) },
    }).success,
  ).toBe(false);
  expect(
    hasDanger({
      ...custom,
      drain: { ...custom.drain!, locationDetail: "감전 위험" },
    }),
  ).toBe(true);
});
it("v1.2 landlord draft uses sentences and only active answers", () => {
  const i = {
    ...input,
    contact: "cost" as const,
    drain: {
      ...input.drain!,
      location: "toilet" as const,
      scope: "multiple" as const,
      attempted: "cleaned" as const,
    },
  };
  const result = makeAnalysis(
    i,
    "00000000-0000-4000-8000-000000000001",
    "mock",
    "test",
  );
  expect(result.messageDraft).not.toContain("문제 문제");
  expect(result.messageDraft).not.toContain(" · ");
  expect(result.messageDraft).not.toContain("잘 모르겠어요");
  expect(result.messageDraft).toContain("문제가 생긴 곳은 변기입니다.");
  expect(result.messageDraft).toContain("여러 배수구에서 함께");
  expect(result.messageDraft).not.toContain("이물질을 제거했지만");
  expect(
    result.drainGuide?.sources.every((s) => !/kohler|abejan/i.test(s.url)),
  ).toBe(true);
});
