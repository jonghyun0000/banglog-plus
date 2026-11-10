import { afterEach, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/routes/app";
import { loadConfig } from "../server/config";
import { defaultIntake, consentVersion } from "../shared/schema";
import {
  MockAnalysisProvider,
  OpenAIAnalysisProvider,
} from "../server/ai/provider";
import { photoReader } from "../server/ai/photo";
import type OpenAI from "openai";
import { knowledgeFixture } from "./helpers/knowledge";
const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  for (const a of apps.splice(0)) await a.app.close();
});
const images = ["data:image/jpeg;base64,/9j/2Q=="];
async function setup(
  readPhoto: NonNullable<Parameters<typeof createApp>[0]>["readPhoto"],
  provider = new MockAnalysisProvider(),
) {
  const a = createApp({ config: loadConfig({}), readPhoto, provider });
  apps.push(a);
  const r = await a.app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: { noticeAccepted: true, consentVersion },
  });
  return { ...a, headers: { authorization: `Bearer ${r.json().token}` } };
}
test("photo observation persists with result but raw bytes never persist; replay does not call twice", async () => {
  const read = vi.fn(async () => ({
    status: "analyzed" as const,
    signs: ["water_trace" as const],
    count: 1,
  }));
  const { app, headers } = await setup(read);
  const payload = {
    intake: defaultIntake,
    idempotencyKey: randomUUID(),
    photos: { consent: true, images },
  };
  const r = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload,
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().photoAnalysis.signs).toEqual(["water_trace"]);
  await app.inject({ method: "POST", url: "/api/analyses", headers, payload });
  expect(read).toHaveBeenCalledTimes(1);
  const record = await app.inject({
    url: `/api/analyses/${r.json().analysisId}`,
    headers,
  });
  expect(record.body).not.toContain("base64");
  expect(record.json().result.photoAnalysis.status).toBe("analyzed");
});
test("photo failure preserves text result and request without photos stays backward compatible", async () => {
  const { app, headers } = await setup(async () => {
    throw Error("timeout");
  });
  const r = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: {
      intake: defaultIntake,
      idempotencyKey: randomUUID(),
      photos: { consent: true, images },
    },
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().photoAnalysis.status).toBe("failed");
  expect(r.json().messageDraft).toBeTruthy();
  const plain = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: {
      intake: { ...defaultIntake, inputVersion: 2 },
      idempotencyKey: randomUUID(),
    },
  });
  expect(plain.statusCode).toBe(200);
  expect(plain.json().photoAnalysis).toBeUndefined();
});
test("danger photo blocks ordinary repair guidance; existing danger bypasses photo call", async () => {
  const read = vi.fn(async () => ({
    status: "analyzed" as const,
    signs: ["exposed_wiring" as const],
    count: 1,
  }));
  const { app, headers } = await setup(read);
  for (const safety of ["none", "fire"] as const) {
    const r = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: {
        intake: {
          ...defaultIntake,
          safety,
          inputVersion: safety === "none" ? 1 : 2,
        },
        idempotencyKey: randomUUID(),
        photos: { consent: true, images },
      },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe("safety_priority");
  }
  expect(read).toHaveBeenCalledTimes(1);
});
test("photo input requires consent and forbids remote URLs and too many images", async () => {
  const read = vi.fn();
  const { app, headers } = await setup(read);
  for (const photos of [
    { consent: false, images },
    { consent: true, images: ["https://example.com/a.jpg"] },
    { consent: true, images: [...images, ...images, ...images, ...images] },
  ]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: { intake: defaultIntake, idempotencyKey: randomUUID(), photos },
    });
    expect(r.statusCode).toBe(400);
  }
  expect(read).not.toHaveBeenCalled();
});
test("image request uses configured model, no storage and enum-only output; irrelevant image cannot create evidence", async () => {
  const parse = vi.fn().mockResolvedValue({
    status: "completed",
    output_parsed: { clear: true, relevant: false, signs: ["water_trace"] },
  });
  const read = photoReader(loadConfig({ OPENAI_MODEL: "test-vision" }), {
    responses: { parse },
  } as unknown as OpenAI);
  expect(
    (await read(images, defaultIntake, new AbortController().signal)).status,
  ).toBe("unclear");
  const args = parse.mock.calls[0][0];
  expect(args.store).toBe(false);
  expect(args.model).toBe("test-vision");
  expect(args.input[0].content[1].type).toBe("input_image");
});
test("photo signs enter DB retrieval, but original input is not changed and missing knowledge still fails closed", async () => {
  const retrieve = vi.fn(async () => knowledgeFixture(defaultIntake));
  const p = new OpenAIAnalysisProvider(
    loadConfig({ OPENAI_API_KEY: "test" }),
    undefined,
    { retrieve },
  );
  await p.prepare(defaultIntake, new AbortController().signal, {
    status: "analyzed",
    signs: ["water_trace"],
    count: 1,
  });
  expect(retrieve.mock.calls[0]).toBeTruthy();
  const args = retrieve.mock.calls as unknown as [[{ description: string }]];
  expect(args[0][0].description).toContain("물자국·젖은 흔적");
  expect(defaultIntake.description).not.toContain("물자국·젖은 흔적");
});
