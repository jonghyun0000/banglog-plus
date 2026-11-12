import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { defaultIntake, intakeSchema, issueSchema } from "../shared/schema.js";
import { observations } from "../shared/questions.js";
import { makeAnalysis, directionFor } from "../shared/analysis.js";
import { makeFallback } from "../shared/fallback.js";
import { missingPhotoViews } from "../shared/photo.js";
import { searchSources, sources } from "../server/sources/catalog.js";
import { validatePlan } from "./helpers/knowledge.js";

for (const issue of ["surface", "drain", "fixture"] as const) {
  it(`${issue}: every selected symptom survives validation and the message without deciding fault`, () => {
    for (const [observation, label] of observations[issue]) {
      const input = intakeSchema.parse({
        ...defaultIntake,
        issue,
        observation,
      });
      const result = makeAnalysis(input, randomUUID(), "mock", "demo");
      expect(result.costResponsibility.direction).toBe("undetermined");
      expect(
        result.userReportedFacts.find((f) => f.key === "observation")?.value,
      ).toBe(label);
      if (observation !== "unknown" && observation !== "light-unknown")
        expect(result.messageDraft).toContain(label);
      else expect(result.messageDraft).not.toContain(label);
      expect(result.citedClaims).toEqual([]);
    }
    for (const other of issueSchema.options.filter((x) => x !== issue)) {
      expect(
        intakeSchema.safeParse({
          ...defaultIntake,
          issue: other,
          observation: observations[issue][0][0],
        }).success,
      ).toBe(false);
    }
  });
  it(`${issue}: preexisting damage, own property, ordinary wear and conflicting accounts stay uncertain`, () => {
    const base = {
      ...defaultIntake,
      issue,
      cause: "damage" as const,
      causeSource: "technician" as const,
    };
    expect(directionFor({ ...base, preexisting: "yes" })).toBe("undetermined");
    expect(directionFor({ ...base, installed: "own" })).toBe("undetermined");
    expect(directionFor({ ...base, cause: "wear" })).toBe("undetermined");
    expect(directionFor({ ...base, otherClaim: "wear" })).toBe("undetermined");
    expect(directionFor({ ...base, causeSource: "landlord" })).toBe(
      "undetermined",
    );
    expect(
      directionFor({ ...base, installed: "original", cause: "aging" }),
    ).toBe("landlord");
  });
  it(`${issue}: safety interrupts repair and no automatic message is offered`, () => {
    const result = makeAnalysis(
      { ...defaultIntake, issue, safety: "electric" },
      randomUUID(),
      "mock",
      "demo",
    );
    expect(result.status).toBe("safety_priority");
    expect(result.messageDraft).toBe("");
    expect(result.repairRequest.recipient).toBe("emergency");
  });
  it(`${issue}: internal live source plan works but public approval gate stays closed`, () => {
    expect(searchSources(issue, true)).toEqual([]);
    expect(
      validatePlan(
        {
          direction: "undetermined",
          claimIds: ["maintenance"],
          sourceVersions: [
            { sourceId: sources[0].id, version: sources[0].version },
          ],
        },
        { ...defaultIntake, issue },
        randomUUID(),
        "test",
      ).citedClaims,
    ).toHaveLength(1);
  });
}
it("lighting symptoms keep inspection, photo evidence and fallback guidance specific", () => {
  const input = intakeSchema.parse({
    ...defaultIntake,
    issue: "fixture",
    observation: "light-replaced",
  });
  const result = makeFallback(input, randomUUID(), "PROVIDER_TIMEOUT");
  expect(result.nextActions[0]).toContain("조명 설비 점검");
  expect(result.messageDraft).toContain("전구·조명");
  expect(result.costResponsibility.direction).toBe("undetermined");
  expect(missingPhotoViews(input)).toEqual(["overview", "closeup"]);
  expect(intakeSchema.safeParse({ ...input, issue: "boiler" }).success).toBe(
    false,
  );
});
it("shared drain cause routes to the manager and asks about common pipes", () => {
  const result = makeAnalysis(
    {
      ...defaultIntake,
      issue: "drain",
      observation: "backflow",
      cause: "third",
    },
    randomUUID(),
    "mock",
    "demo",
  );
  expect(result.repairRequest.recipient).toBe("manager");
  expect(result.messageDraft).toContain("공용부분");
  expect(result.nextActions.join(" ")).toContain("물 사용을 멈추고");
});

it("developer defect claims and disposal crime disputes are outside repair guidance", () => {
  for (const description of [
    "시공사에 하자보수 청구",
    "냉장고를 버렸는데 절도인가요",
  ]) {
    const result = makeAnalysis(
      { ...defaultIntake, issue: "fixture", description },
      randomUUID(),
      "mock",
      "demo",
    );
    expect(result.status).toBe("out_of_scope");
    expect(result.messageDraft).toBe("");
  }
});

it("personally owned appliances route to service support without a landlord cost demand", () => {
  const result = makeAnalysis(
    {
      ...defaultIntake,
      issue: "fixture",
      observation: "fridge",
      installed: "own",
      contact: "waiting",
    },
    randomUUID(),
    "mock",
    "demo",
  );
  expect(result.repairRequest.recipient).toBe("service");
  expect(result.costResponsibility.direction).toBe("undetermined");
  expect(result.messageKind).toBe("initial");
  expect(result.messageDraft).toContain("제가 소유한 제품");
  expect(result.messageDraft).toContain("보증 적용");
});
