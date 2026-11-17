import { describe, expect, it } from "vitest";
import { defaultIntake, intakeSchema } from "../shared/schema";
import { hasDanger, sanitizeIntake, intakeContext } from "../shared/safety";
import { historySchema } from "../shared/account";
import { makeAnalysis } from "../shared/analysis";

describe("free-text safety concerns", () => {
  it("keeps old saved answers compatible and validates the new field", () => {
    expect(intakeSchema.parse(defaultIntake)).not.toHaveProperty(
      "safetyDescription",
    );
    expect(
      intakeSchema.safeParse({
        ...defaultIntake,
        safetyDescription: "x".repeat(241),
      }).success,
    ).toBe(false);
    expect(hasDanger({ ...defaultIntake, safety: "gas" })).toBe(true);
  });
  it("blocks typed Korean and English hazards even if none was also submitted", () => {
    for (const safetyDescription of [
      "가스 냄새가 나요",
      "콘센트에서 불꽃이 나요",
      "감전됐어요",
      "I smell gas",
      "sparks from the outlet",
      "Sparks are coming from a socket",
    ]) {
      const input = {
        ...defaultIntake,
        safety: "none" as const,
        safetyDescription,
      };
      expect(hasDanger(input)).toBe(true);
      expect(
        makeAnalysis(
          input,
          "11111111-1111-4111-8111-111111111111",
          "mock",
          "demo",
        ).status,
      ).toBe("safety_priority");
    }
  });
  it("masks personal data and retains the concern in context and saved result facts", () => {
    const input = sanitizeIntake({
      ...defaultIntake,
      safetyDescription: "차단기 상태를 확인하지 못했어요. 010-1234-5678",
    });
    expect(input.safetyDescription).not.toContain("010-1234-5678");
    expect(intakeContext(input)).toContain("직접 입력한 위험 신호:");
    expect(
      makeAnalysis(
        input,
        "11111111-1111-4111-8111-111111111111",
        "mock",
        "demo",
      ).userReportedFacts,
    ).toContainEqual({
      key: "직접 입력한 위험 신호",
      value: input.safetyDescription,
      provenance: "tenant_report",
    });
    const record = historySchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      input,
      result: makeAnalysis(
        input,
        "11111111-1111-4111-8111-111111111111",
        "mock",
        "demo",
      ),
      createdAt: "2026-11-17T00:00:00Z",
      expiresAt: "2027-11-17T00:00:00Z",
    });
    expect(record.input.safetyDescription).toBe(input.safetyDescription);
    expect(hasDanger(input)).toBe(false);
    expect(
      hasDanger({ ...input, safety: "none", description: "가스 냄새가 나요" }),
    ).toBe(true);
  });
});
