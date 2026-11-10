import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  defaultIntake,
  intakeSchema,
  analysisSchema,
} from "../shared/schema.js";
import { makeFallback } from "../shared/fallback.js";
import { createApp } from "../server/routes/app.js";
import { loadConfig } from "../server/config.js";
import { consentVersion } from "../shared/schema.js";
const cases = JSON.parse(
  readFileSync(
    new URL("../data/research/2026-11-05/evaluation-12.json", import.meta.url),
    "utf8",
  ),
) as { id: string; label: string; input: Record<string, unknown> }[];
// Software behavior checks, not expert ratings or model accuracy measurements.
it.each(cases)(
  "pilot $id: $label preserves safe fallback and intake facts",
  ({ id, input }) => {
    const intake = intakeSchema.parse({ ...defaultIntake, ...input });
    if (id === "B2") return; // API emergency bypass is tested separately below.
    const result = makeFallback(intake, randomUUID(), "KNOWLEDGE_NOT_FOUND");
    expect(analysisSchema.safeParse(result).success).toBe(true);
    expect(result.costResponsibility.direction).toBe("undetermined");
    expect(result.citedClaims).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.aiExplanation).toBeUndefined();
    expect(result.messageDraft?.length).toBeGreaterThan(0);
    if (id === "D1") expect(result.drainGuide?.route).toBe("self_check");
    if (id === "D2") expect(result.drainGuide?.route).toBe("stop");
    if (id === "F2") expect(result.repairRequest.recipient).toBe("service");
  },
);
it("gas scenario never calls knowledge retrieval or GPT", async () => {
  let calls = 0;
  const { app } = createApp({
    config: loadConfig({}),
    provider: {
      mode: "live",
      estimate: () => 1,
      prepare: async () => {
        calls++;
        throw new Error("must not retrieve");
      },
      analyze: async () => {
        calls++;
        throw new Error("must not generate");
      },
    },
  });
  try {
    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers: { authorization: `Bearer ${session.json().token}` },
      payload: {
        intake: {
          ...defaultIntake,
          ...cases.find((c) => c.id === "B2")!.input,
        },
        idempotencyKey: randomUUID(),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("safety_priority");
    expect(calls).toBe(0);
  } finally {
    await app.close();
  }
});
