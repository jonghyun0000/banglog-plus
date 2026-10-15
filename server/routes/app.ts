import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  analysisSchema,
  analyzeRequestSchema,
  consentVersion,
  feedbackSchema,
} from "../../shared/schema.js";
import { sanitizeIntake, hasDanger, outOfScope } from "../../shared/safety.js";
import { loadConfig, publicConfig } from "../config.js";
import type { Config } from "../config.js";
import { AppError, messages } from "../domain/errors.js";
import { makeAnalysis } from "../domain/analysis.js";
import {
  MockAnalysisProvider,
  OpenAIAnalysisProvider,
} from "../ai/provider.js";
import type { AnalysisProvider } from "../ai/provider.js";
import type { Guest, Repository } from "../repositories/types.js";
import { MemoryRepository } from "../repositories/memory.js";
import { PostgresRepository } from "../repositories/postgres.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createApp(
  options: {
    config?: Config;
    repository?: Repository;
    provider?: AnalysisProvider;
    now?: () => number;
  } = {},
) {
  const config = options.config ?? loadConfig();
  const state = publicConfig(config);
  const repo =
    options.repository ??
    (config.REPOSITORY === "database" && config.DATABASE_URL
      ? new PostgresRepository(
          config.DATABASE_URL,
          config.DATABASE_SSL !== "disable",
        )
      : new MemoryRepository());
  const provider =
    options.provider ??
    (config.AI_MODE === "live" && state.ready
      ? new OpenAIAnalysisProvider(config)
      : new MockAnalysisProvider());
  const app = Fastify({ logger: false, bodyLimit: 16384, trustProxy: false });
  const now = options.now ?? Date.now;
  const rates = new Map<string, { count: number; reset: number }>();
  const inflight = new Map<string, AbortController>();
  let active = 0;
  function limit(key: string, max: number, windowMs: number) {
    const t = now();
    const entry = rates.get(key);
    if (!entry || entry.reset <= t) {
      rates.set(key, { count: 1, reset: t + windowMs });
    } else {
      if (entry.count >= max) throw new AppError("RATE_LIMIT", 429);
      entry.count++;
    }
    if (rates.size > 10000) {
      for (const [k, v] of rates) if (v.reset < t) rates.delete(k);
      if (rates.size > 10000) throw new AppError("RATE_LIMIT", 429);
    }
  }
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    const origin = req.headers.origin;
    const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    if (origin && !allowed.includes(origin))
      throw new AppError("ORIGIN_DENIED", 403);
    if (origin)
      reply
        .header("Access-Control-Allow-Origin", origin)
        .header("Vary", "Origin");
    if (req.method === "OPTIONS")
      return reply
        .header("Access-Control-Allow-Headers", "Authorization,Content-Type")
        .header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
        .code(204)
        .send();
    limit(`all:${hash(req.ip)}`, 240, 60000);
  });
  app.setErrorHandler((error, _req, reply) => {
    const e =
      error instanceof AppError
        ? error
        : error instanceof z.ZodError ||
            (typeof error === "object" &&
              error !== null &&
              "statusCode" in error &&
              [400, 413].includes(Number(error.statusCode)))
          ? new AppError("INVALID_INPUT", 400)
          : new AppError("STORAGE_FAILURE", 503);
    reply.code(e.status).send({
      code: e.code,
      message: messages[e.code] ?? messages.INTERNAL_ERROR,
    });
  });
  async function guest(req: FastifyRequest): Promise<Guest> {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError("UNAUTHORIZED", 401);
    const g = await repo.authenticate(hash(token));
    if (!g) throw new AppError("UNAUTHORIZED", 401);
    return g;
  }
  app.get("/api/config", async () => state);
  app.post("/api/sessions", async (req, reply) => {
    if (!state.ready) throw new AppError("CONFIG_NOT_READY", 503);
    const c = z
      .object({
        noticeAccepted: z.literal(true),
        consentVersion: z.literal(consentVersion),
      })
      .strict()
      .safeParse(req.body);
    if (!c.success) throw new AppError("CONSENT_REQUIRED", 400);
    limit(`session:${hash(req.ip)}`, 12, 3600000);
    const token = randomBytes(32).toString("hex");
    const g = await repo.createGuest(hash(token), consentVersion);
    await repo.metric(g.id, { event: "start", mode: config.AI_MODE });
    return reply
      .code(201)
      .send({ token, expiresAt: new Date(g.expiresAt).toISOString() });
  });
  app.delete("/api/session", async (req, reply) => {
    const g = await guest(req);
    await repo.deleteGuest(g.id);
    for (const [k, c] of inflight) if (k.startsWith(`${g.id}:`)) c.abort();
    return reply.code(204).send();
  });
  app.post("/api/analyses", async (req, reply) => {
    if (!state.ready) throw new AppError("CONFIG_NOT_READY", 503);
    const g = await guest(req);
    const body = analyzeRequestSchema.parse(req.body);
    const input = sanitizeIntake(body.intake);
    limit(`analysis:${g.id}`, 20, 3600000);
    const { record, created } = await repo.createAnalysis(
      g.id,
      body.idempotencyKey,
      hash(JSON.stringify(input)),
      input,
    );
    if (!created) {
      if (record.state === "complete") return record.result;
      if (record.state === "pending") throw new AppError("IN_PROGRESS", 409);
      throw new AppError(
        record.state === "cancelled" ? "CANCELLED" : "FAILED",
        409,
      );
    }
    const controller = new AbortController();
    const key = `${g.id}:${body.idempotencyKey}`;
    inflight.set(key, controller);
    const start = now();
    let counted = false;
    const onClose = () => {
      if (!reply.raw.writableEnded) controller.abort();
    };
    reply.raw.on("close", onClose);
    try {
      await repo.metric(g.id, {
        event: "questions_complete",
        analysisId: record.id,
        mode: config.AI_MODE,
      });
      let output;
      if (hasDanger(input) || outOfScope(input.description)) {
        output = {
          result: makeAnalysis(
            input,
            record.id,
            config.AI_MODE,
            "safety-scope-rules",
          ),
          inputTokens: 0,
          outputTokens: 0,
        };
      } else {
        if (active >= config.MAX_CONCURRENT)
          throw new AppError("CONCURRENCY_LIMIT", 429);
        active++;
        counted = true;
        if (provider.mode === "live") {
          const tokens = provider.estimate(input);
          const usd = config.DAILY_BUDGET_USD
            ? (tokens *
                Math.max(
                  Number(config.INPUT_USD_PER_MILLION),
                  Number(config.OUTPUT_USD_PER_MILLION),
                )) /
              1e6
            : null;
          await repo.reserve(tokens, usd, {
            calls: config.MAX_DAILY_CALLS,
            tokens: config.MAX_DAILY_TOKENS,
            usd: config.DAILY_BUDGET_USD
              ? Number(config.DAILY_BUDGET_USD)
              : null,
          });
        }
        output = await provider.analyze(input, record.id, controller.signal);
      }
      if (controller.signal.aborted) throw new AppError("CANCELLED", 409);
      const result = analysisSchema.parse(output.result);
      if (!(await repo.finish(g.id, record.id, result)))
        throw new AppError("CANCELLED", 409);
      if (!hasDanger(input) && !outOfScope(input.description))
        await repo.metric(g.id, {
          event: "analysis_success",
          analysisId: record.id,
          mode: config.AI_MODE,
          latencyMs: now() - start,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          costUsd:
            provider.mode === "mock"
              ? 0
              : config.DAILY_BUDGET_USD
                ? (output.inputTokens * Number(config.INPUT_USD_PER_MILLION) +
                    output.outputTokens *
                      Number(config.OUTPUT_USD_PER_MILLION)) /
                  1e6
                : null,
        });
      return result;
    } catch (e) {
      const code = e instanceof AppError ? e.code : "STORAGE_FAILURE";
      await repo.fail(g.id, record.id, code);
      throw e;
    } finally {
      if (counted) active--;
      inflight.delete(key);
      reply.raw.off("close", onClose);
    }
  });
  app.get("/api/analyses/:id", async (req) => {
    const g = await guest(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await repo.getAnalysis(g.id, id);
    if (!r) throw new AppError("NOT_FOUND", 404);
    return { state: r.state, input: r.input, result: r.result };
  });
  app.post("/api/analyses/cancel", async (req, reply) => {
    const g = await guest(req);
    const { idempotencyKey } = z
      .object({ idempotencyKey: z.string().uuid() })
      .strict()
      .parse(req.body);
    await repo.cancel(g.id, idempotencyKey);
    inflight.get(`${g.id}:${idempotencyKey}`)?.abort();
    return reply.code(204).send();
  });
  app.post("/api/analyses/:id/feedback", async (req, reply) => {
    const g = await guest(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await repo.feedback(g.id, id, feedbackSchema.parse(req.body));
    await repo.metric(g.id, {
      event: "feedback",
      analysisId: id,
      mode: config.AI_MODE,
    });
    return reply.code(204).send();
  });
  app.post("/api/analyses/:id/events", async (req, reply) => {
    const g = await guest(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    z.object({ event: z.literal("copy_success") })
      .strict()
      .parse(req.body);
    const r = await repo.getAnalysis(g.id, id);
    if (!r?.result) throw new AppError("NOT_FOUND", 404);
    await repo.metric(g.id, {
      event: "copy_success",
      analysisId: id,
      mode: config.AI_MODE,
    });
    return reply.code(204).send();
  });
  app.addHook("onClose", async () => {
    for (const c of inflight.values()) c.abort();
    await repo.close();
  });
  return { app, repo, provider };
}
