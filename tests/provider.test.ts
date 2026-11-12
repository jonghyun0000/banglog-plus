import { it, expect } from "vitest";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { OpenAIAnalysisProvider } from "../server/ai/provider.js";
import { loadConfig } from "../server/config.js";
import { sources } from "../server/sources/catalog.js";
import { defaultIntake } from "../shared/schema.js";
import { tailoredPlan, fixtureRetriever } from "./helpers/knowledge.js";
const config = loadConfig({ OPENAI_MODEL: "explicit-test-model" });
const plan = {
  tailoredResponse: tailoredPlan(),
  direction: "undetermined",
  explanation:
    "현재 입력만으로 원인이나 비용 부담을 확정할 수 없어요. 입주 당시 상태와 점검 기록을 함께 확인해 주세요.",
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
  const p = new OpenAIAnalysisProvider(config, client, fixtureRetriever);
  const r = await p.analyze(
    defaultIntake,
    randomUUID(),
    new AbortController().signal,
  );
  expect(body.store).toBe(false);
  expect(body.model).toBe("explicit-test-model");
  expect(body.tools).toBeUndefined();
  expect(r.result.mode).toBe("live");
  expect(r.result.aiExplanation).toBe(plan.explanation);
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
    new OpenAIAnalysisProvider(config, client, fixtureRetriever).analyze(
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
    new OpenAIAnalysisProvider(config, client, fixtureRetriever).analyze(
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
    new OpenAIAnalysisProvider(config, client, fixtureRetriever).analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMIT" });
  expect(calls).toBe(1);
});
it("new live responses without tailored actions fail closed", async () => {
  const { tailoredResponse: _removed, ...oldPlan } = plan;
  void _removed;
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async () =>
      new Response(JSON.stringify(envelope(JSON.stringify(oldPlan))), {
        headers: { "content-type": "application/json" },
      }),
  });
  await expect(
    new OpenAIAnalysisProvider(config, client, fixtureRetriever).analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "PROVIDER_OUTPUT" });
});

it("generates English using the same verified claims and retains their canonical links", async () => {
  const englishPlan = {
    ...plan,
    explanation:
      "The reported symptoms call for an inspection before discussing repair costs.",
    tailoredResponse: {
      summary:
        "The cause is still unclear. Gather the inspection findings first.",
      steps: tailoredPlan().steps.map((step, index) => ({
        ...step,
        title: index === 0 ? "Request an inspection" : "Check move-in records",
        action:
          index === 0
            ? "Ask the landlord to confirm the inspection schedule in writing."
            : "Compare the current condition with your move-in records.",
        reason:
          "The maintenance duty can support an inspection request, but the cause still needs to be checked.",
      })),
    },
  };
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.instructions).toContain("in plain English only");
      expect(JSON.parse(body.input).claims).toContainEqual(
        expect.objectContaining({ id: "maintenance", sourceId: sources[0].id }),
      );
      return new Response(
        JSON.stringify(envelope(JSON.stringify(englishPlan))),
        {
          headers: { "content-type": "application/json" },
        },
      );
    },
  });
  const provider = new OpenAIAnalysisProvider(config, client, fixtureRetriever);
  const analyze = () =>
    provider.analyze(
      defaultIntake,
      randomUUID(),
      new AbortController().signal,
      undefined,
      undefined,
      "en",
    );
  const { result } = await analyze();
  expect(result).toMatchObject({
    responseLanguage: "en",
    aiExplanation: englishPlan.explanation,
    sources: [expect.objectContaining({ url: sources[0].url })],
  });
  expect(result.tailoredResponse?.steps[0]).toMatchObject({
    missingEvidence: ["Original inspection record"],
    citations: [expect.objectContaining({ sourceId: sources[0].id })],
  });

  englishPlan.tailoredResponse.steps[0].action = plan.explanation;
  await expect(analyze()).rejects.toMatchObject({ code: "PROVIDER_OUTPUT" });
});
