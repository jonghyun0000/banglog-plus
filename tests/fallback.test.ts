import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/routes/app.js";
import { loadConfig } from "../server/config.js";
import { AppError } from "../server/domain/errors.js";
import { consentVersion, defaultIntake } from "../shared/schema.js";
import { fallbackCodes, makeFallback } from "../shared/fallback.js";
import { MemoryRepository } from "../server/repositories/memory.js";
import { makeAnalysis } from "../shared/analysis.js";
it.each(fallbackCodes)(
  "%s returns a labelled saved basic guide without invented citations",
  async (code) => {
    let calls = 0;
    const repo = new MemoryRepository();
    const { app } = createApp({
      config: loadConfig({}),
      repository: repo,
      provider: {
        mode: "live",
        estimate: () => 10,
        analyze: async () => {
          calls++;
          throw new AppError(code, 503);
        },
      },
    });
    try {
      const session = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { noticeAccepted: true, consentVersion },
      });
      const headers = { authorization: `Bearer ${session.json().token}` };
      const payload = {
        intake: { ...defaultIntake, cause: "damage", causeSource: "self" },
        idempotencyKey: randomUUID(),
      };
      const result = await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers,
        payload,
      });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toMatchObject({
        mode: "mock",
        model: "offline-rules-1",
        fallback: { reason: code },
        costResponsibility: { direction: "undetermined" },
        sources: [],
        citedClaims: [],
      });
      expect(result.json().aiExplanation).toBeUndefined();
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/analyses",
            headers,
            payload,
          })
        ).json(),
      ).toEqual(result.json());
      expect(calls).toBe(1);
      const metrics = [...repo.metrics.values()].filter(
        (m) => m.data.event === "analysis_success",
      );
      expect(metrics[0].data).toMatchObject({
        mode: "mock",
        failureCode: code,
        costUsd: null,
      });
    } finally {
      await app.close();
    }
  },
);
it.each(["CANCELLED", "UNAUTHORIZED", "STORAGE_FAILURE"])(
  "%s is never disguised as a successful fallback",
  async (code) => {
    const { app } = createApp({
      config: loadConfig({}),
      provider: {
        mode: "live",
        estimate: () => 1,
        analyze: async () => {
          throw new AppError(code, 409);
        },
      },
    });
    try {
      const s = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { noticeAccepted: true, consentVersion },
      });
      const r = await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers: { authorization: `Bearer ${s.json().token}` },
        payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
      });
      expect(r.statusCode).toBe(409);
      expect(r.json().code).toBe(code);
    } finally {
      await app.close();
    }
  },
);
it("successful provider result is retained instead of replaced by fallback", async () => {
  const { app } = createApp({
    config: loadConfig({}),
    provider: {
      mode: "live",
      estimate: () => 1,
      analyze: async (i, id) => ({
        result: {
          ...makeAnalysis(i, id, "live", "test-model"),
          aiExplanation:
            "입력한 내용과 관련 근거를 함께 확인했어요. 실제 원인은 점검 기록으로 확인해 주세요.",
        },
        inputTokens: 5,
        outputTokens: 10,
      }),
    },
  });
  try {
    const s = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    const r = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers: { authorization: `Bearer ${s.json().token}` },
      payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().mode).toBe("live");
    expect(r.json().aiExplanation).toContain("관련 근거");
    expect(r.json().fallback).toBeUndefined();
  } finally {
    await app.close();
  }
});
it("all six issue types have relevant fixed checks", () => {
  for (const issue of [
    "mold",
    "leak",
    "boiler",
    "surface",
    "drain",
    "fixture",
  ] as const) {
    const r = makeFallback(
      { ...defaultIntake, issue },
      randomUUID(),
      "PROVIDER_TIMEOUT",
    );
    expect(r.nextActions).toHaveLength(3);
    expect(r.costResponsibility.direction).toBe("undetermined");
    expect(r.sources).toEqual([]);
  }
});
