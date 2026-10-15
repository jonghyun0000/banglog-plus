import { it, expect } from "vitest";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { OpenAIAnalysisProvider } from "../server/ai/provider.js";
import { loadConfig } from "../server/config.js";
import { sources } from "../server/sources/catalog.js";
import { defaultIntake } from "../shared/schema.js";
const config = loadConfig({ OPENAI_MODEL: "explicit-test-model" });
const plan = {
  direction: "undetermined",
  claimIds: ["maintenance"],
  sourceVersions: [{ sourceId: sources[0].id, version: sources[0].version }],
};
function envelope(text: string, refusal = false) {
  return {
    id: "resp_test",
    object: "response",
    status: "completed",
    model: "explicit-test-model",
    output: [
      {
        id: "msg_test",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          refusal
            ? { type: "refusal", refusal: "declined" }
            : { type: "output_text", text, annotations: [] },
        ],
      },
    ],
    usage: { input_tokens: 30, output_tokens: 40, total_tokens: 70 },
  };
}
it("official SDK structured parse sends store:false, explicit model and no tools", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async (_url, init) => {
      body = JSON.parse(init?.body as string);
      return new Response(JSON.stringify(envelope(JSON.stringify(plan))), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const p = new OpenAIAnalysisProvider(config, client);
  const r = await p.analyze(
    defaultIntake,
    randomUUID(),
    new AbortController().signal,
  );
  expect(body.store).toBe(false);
  expect(body.model).toBe("explicit-test-model");
  expect(body.tools).toBeUndefined();
  expect(r.result.mode).toBe("live");
  expect(r.result.citedClaims).toHaveLength(1);
  expect(r.inputTokens).toBe(30);
});
it("official SDK malformed JSON is rejected", async () => {
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async () =>
      new Response(JSON.stringify(envelope("{broken")), {
        headers: { "content-type": "application/json" },
      }),
  });
  await expect(
    new OpenAIAnalysisProvider(config, client).analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "PROVIDER_OUTPUT" });
});
it("official SDK refusal is distinct", async () => {
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async () =>
      new Response(JSON.stringify(envelope("", true)), {
        headers: { "content-type": "application/json" },
      }),
  });
  await expect(
    new OpenAIAnalysisProvider(config, client).analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "PROVIDER_REFUSAL" });
});
it("official SDK 429 is distinct and no retries", async () => {
  let calls = 0;
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({ error: { message: "rate limit" } }),
        { status: 429, headers: { "content-type": "application/json" } },
      );
    },
  });
  await expect(
    new OpenAIAnalysisProvider(config, client).analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
  expect(calls).toBe(1);
});
