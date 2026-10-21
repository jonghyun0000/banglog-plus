import { afterEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/routes/app.js";
import { loadConfig } from "../server/config.js";
import { defaultIntake, consentVersion } from "../shared/schema.js";
import { MemoryRepository } from "../server/repositories/memory.js";
import { MockAnalysisProvider } from "../server/ai/provider.js";
import type {
  AnalysisProvider,
  ProviderResult,
} from "../server/ai/provider.js";
import { AppError } from "../server/domain/errors.js";
import { makeAnalysis } from "../server/domain/analysis.js";
const instances: ReturnType<typeof createApp>[] = [];
function setup(options: Parameters<typeof createApp>[0] = {}) {
  const obj = createApp({ config: loadConfig({}), ...options });
  instances.push(obj);
  return obj;
}
afterEach(async () => {
  await Promise.all(instances.splice(0).map((x) => x.app.close()));
});
async function session(app: ReturnType<typeof createApp>["app"]) {
  const r = await app.inject({
    method: "POST",
    url: "/api/sessions",
    payload: { noticeAccepted: true, consentVersion },
  });
  expect(r.statusCode).toBe(201);
  return { authorization: `Bearer ${r.json().token}` };
}
function deferred() {
  let resolve!: (value: ProviderResult) => void;
  const promise = new Promise<ProviderResult>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}
it("complete flow, idempotency, feedback, events and deletion", async () => {
  const { app, repo } = setup();
  const headers = await session(app);
  const payload = { intake: defaultIntake, idempotencyKey: randomUUID() };
  const first = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload,
  });
  expect(first.statusCode).toBe(200);
  const id = first.json().analysisId;
  const repeat = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload,
  });
  expect(repeat.json().analysisId).toBe(id);
  expect((repo as MemoryRepository).records.size).toBe(1);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers,
        payload: {
          ...payload,
          intake: { ...defaultIntake, description: "변경" },
        },
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/analyses/${id}/feedback`,
        headers,
        payload: { helpful: "yes", understood: "yes", errorType: "none" },
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/analyses/${id}/events`,
        headers,
        payload: { event: "copy_success" },
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (await app.inject({ method: "DELETE", url: "/api/session", headers }))
      .statusCode,
  ).toBe(204);
  expect((repo as MemoryRepository).records.size).toBe(0);
  expect((repo as MemoryRepository).metrics.size).toBe(0);
  expect(
    (await app.inject({ method: "GET", url: `/api/analyses/${id}`, headers }))
      .statusCode,
  ).toBe(401);
});
it("other guest cannot read, cancel, mutate, delete or attach feedback", async () => {
  const { app, repo } = setup();
  const a = await session(app),
    b = await session(app);
  const key = randomUUID();
  const r = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers: a,
    payload: { intake: defaultIntake, idempotencyKey: key },
  });
  const id = r.json().analysisId;
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/api/analyses/${id}`,
        headers: b,
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/analyses/${id}/feedback`,
        headers: b,
        payload: { helpful: "yes", understood: "yes", errorType: "none" },
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/analyses/${id}`,
        headers: b,
        payload: { owner: "attacker" },
      })
    ).statusCode,
  ).toBe(404);
  await app.inject({
    method: "POST",
    url: "/api/analyses/cancel",
    headers: b,
    payload: { idempotencyKey: key },
  });
  await app.inject({ method: "DELETE", url: "/api/session", headers: b });
  expect((repo as MemoryRepository).records.get(id)?.state).toBe("complete");
  expect(
    (await app.inject({ method: "GET", url: `/api/analyses/${id}` }))
      .statusCode,
  ).toBe(401);
});
it("expiry revokes access and cleanup deletes dependencies", async () => {
  let now = 1000;
  const repo = new MemoryRepository(() => now);
  const { app } = setup({ repository: repo });
  const headers = await session(app);
  await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
  });
  now += 86400001;
  expect(
    (await app.inject({ method: "DELETE", url: "/api/session", headers }))
      .statusCode,
  ).toBe(401);
  expect(await repo.cleanup()).toBe(1);
  expect(repo.records.size).toBe(0);
});
it("requires notice, rejects forged fields and oversized input", async () => {
  const { app } = setup();
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { noticeAccepted: false, consentVersion },
      })
    ).statusCode,
  ).toBe(400);
  const headers = await session(app);
  for (const intake of [
    { ...defaultIntake, userId: "fake" },
    { ...defaultIntake, description: "x".repeat(1001) },
  ])
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/analyses",
          headers,
          payload: { intake, idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
});
it("limits new sessions and disallowed origins", async () => {
  const { app } = setup();
  for (let i = 0; i < 12; i++) await session(app);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { noticeAccepted: true, consentVersion },
      })
    ).statusCode,
  ).toBe(429);
  expect(
    (
      await app.inject({
        method: "GET",
        url: "/api/config",
        headers: { origin: "https://untrusted.example" },
      })
    ).statusCode,
  ).toBe(403);
});
it("input and response never contain session token; personal data is masked", async () => {
  const { app, repo } = setup();
  const headers = await session(app);
  const r = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: {
      intake: { ...defaultIntake, description: "010-1234-5678" },
      idempotencyKey: randomUUID(),
    },
  });
  expect(r.body).not.toContain("010-1234-5678");
  expect(r.body).not.toContain(headers.authorization.slice(7));
  expect(
    JSON.stringify([...(repo as MemoryRepository).guests.values()]),
  ).not.toContain(headers.authorization.slice(7));
});
it("safety and scope bypass provider", async () => {
  const provider = new MockAnalysisProvider();
  const spy = vi.spyOn(provider, "analyze");
  const { app } = setup({ provider });
  const headers = await session(app);
  for (const [index, description] of ["가스 냄새", "보증금 반환"].entries())
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/analyses",
          headers,
          payload: {
            intake: { ...defaultIntake, inputVersion: index + 1, description },
            idempotencyKey: randomUUID(),
          },
        })
      ).statusCode,
    ).toBe(200);
  expect(spy).not.toHaveBeenCalled();
});
describe("provider failures remain errors", () => {
  for (const [code, status] of [
    ["PROVIDER_REFUSAL", 422],
    ["PROVIDER_OUTPUT", 502],
    ["PROVIDER_TIMEOUT", 504],
    ["PROVIDER_RATE_LIMIT", 429],
    ["PROVIDER_FAILURE", 502],
  ] as const)
    it(code, async () => {
      const provider: AnalysisProvider = {
        mode: "mock",
        estimate: () => 0,
        analyze: async () => {
          throw new AppError(code, status);
        },
      };
      const { app, repo } = setup({ provider });
      const headers = await session(app);
      const r = await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers,
        payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
      });
      expect(r.statusCode).toBe(status);
      expect(r.json().code).toBe(code);
      expect(
        [...(repo as MemoryRepository).records.values()][0].result,
      ).toBeNull();
    });
});
it("storage failure is not fake success", async () => {
  const repo = new MemoryRepository();
  vi.spyOn(repo, "finish").mockRejectedValue(
    new Error("database secret payload"),
  );
  const { app } = setup({ repository: repo });
  const headers = await session(app);
  const r = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
  });
  expect(r.statusCode).toBe(503);
  expect(r.body).not.toContain("secret");
});
it("deleted session cannot resurrect with late AI output", async () => {
  const deferredResponse = deferred();
  let started!: () => void;
  const start = new Promise<void>((r) => {
    started = r;
  });
  let aid = "";
  const provider: AnalysisProvider = {
    mode: "mock",
    estimate: () => 0,
    analyze: async (_i, id) => {
      aid = id;
      started();
      return deferredResponse.promise;
    },
  };
  const { app, repo } = setup({ provider });
  const headers = await session(app);
  const pending = app
    .inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
    })
    .then((r) => r);
  await start;
  await app.inject({ method: "DELETE", url: "/api/session", headers });
  deferredResponse.resolve({
    result: makeAnalysis(defaultIntake, aid, "mock", "demo"),
    inputTokens: 0,
    outputTokens: 0,
  });
  expect((await pending).statusCode).toBe(409);
  expect((repo as MemoryRepository).records.size).toBe(0);
});
it("concurrency, duplicate pending request and cancellation are bounded", async () => {
  const d = deferred();
  let started!: () => void;
  const start = new Promise<void>((r) => {
    started = r;
  });
  let id = "";
  const provider: AnalysisProvider = {
    mode: "mock",
    estimate: () => 0,
    analyze: async (_i, aid) => {
      id = aid;
      started();
      return d.promise;
    },
  };
  const { app } = setup({
    provider,
    config: loadConfig({ MAX_CONCURRENT: "1" }),
  });
  const headers = await session(app),
    other = await session(app);
  const payload = { intake: defaultIntake, idempotencyKey: randomUUID() };
  const pending = app
    .inject({ method: "POST", url: "/api/analyses", headers, payload })
    .then((r) => r);
  await start;
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers,
        payload,
      })
    ).json().code,
  ).toBe("IN_PROGRESS");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/analyses",
        headers: other,
        payload: { ...payload, idempotencyKey: randomUUID() },
      })
    ).json().code,
  ).toBe("CONCURRENCY_LIMIT");
  await app.inject({
    method: "POST",
    url: "/api/analyses/cancel",
    headers,
    payload: { idempotencyKey: payload.idempotencyKey },
  });
  d.resolve({
    result: makeAnalysis(defaultIntake, id, "mock", "demo"),
    inputTokens: 0,
    outputTokens: 0,
  });
  expect((await pending).json().code).toBe("CANCELLED");
});
it("budget reservations are atomic and survive uncertain provider failures", async () => {
  const repo = new MemoryRepository();
  const outcomes = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      repo.reserve(10, 1, { calls: 2, tokens: 20, usd: 2 }),
    ),
  );
  expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(2);
  expect(repo.budget.calls).toBe(2);
});
it("live mode missing configuration cannot silently return a demo", async () => {
  const { app } = setup({ config: loadConfig({ AI_MODE: "live" }) });
  expect((await app.inject("/api/config")).json().ready).toBe(false);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { noticeAccepted: true, consentVersion },
      })
    ).statusCode,
  ).toBe(503);
});

it("accepts the new repair categories and rejects cross-category symptoms", async () => {
  const { app } = setup();
  const headers = await session(app);
  for (const [index, [issue, observation]] of (
    [
      ["surface", "wall-tear"],
      ["drain", "slow-drain"],
      ["fixture", "washer"],
    ] as const
  ).entries()) {
    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: {
        intake: {
          ...defaultIntake,
          inputVersion: index + 1,
          issue,
          observation,
        },
        idempotencyKey: randomUUID(),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().costResponsibility.direction).toBe("undetermined");
  }
  const invalid = await app.inject({
    method: "POST",
    url: "/api/analyses",
    headers,
    payload: {
      intake: {
        ...defaultIntake,
        issue: "drain",
        observation: "fridge",
        inputVersion: 4,
      },
      idempotencyKey: randomUUID(),
    },
  });
  expect(invalid.statusCode).toBe(400);
});
