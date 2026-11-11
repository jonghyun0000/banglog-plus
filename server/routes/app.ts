import {
  photoReader,
  photoTokenBudget,
  type PhotoReader,
} from "../ai/photo.js";
import {
  missingPhotoViews,
  photoDanger,
  photoResultSchema,
  type PhotoResult,
} from "../../shared/photo.js";
import { lookupBuilding, lotSchema } from "../building.js";
import { registerAdmin, clientIp } from "../admin/routes.js";
import { Operations } from "../operations.js";
import { fallbackCodes, makeFallback } from "../../shared/fallback.js";
import { supabaseVerifier, type VerifyMember } from "../auth/member.js";
import { PostgresHistory, type HistoryStore } from "../repositories/history.js";
import { historyConsentVersion } from "../../shared/account.js";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  analysisSchema,
  analyzeRequestSchema,
  consentVersion,
  feedbackSchema,
  intakeSchema,
} from "../../shared/schema.js";
import {
  sanitizeIntake,
  hasDanger,
  outOfScope,
  intakeContext,
  maskPersonalData,
} from "../../shared/safety.js";
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
import { PostgresKnowledgeRetriever } from "../sources/retrieval.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createApp(
  options: {
    config?: Config;
    readPhoto?: PhotoReader;
    repository?: Repository;
    provider?: AnalysisProvider;
    now?: () => number;
    verifyMember?: VerifyMember;
    history?: HistoryStore;
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
  const history =
    options.history ??
    (repo instanceof PostgresRepository ? new PostgresHistory(repo) : null);
  const ops =
    repo instanceof PostgresRepository &&
    config.PUBLIC_LAUNCH_ENABLED === "true"
      ? new Operations(repo)
      : null;
  const verifyMember =
    options.verifyMember ??
    supabaseVerifier(
      config,
      fetch,
      ops
        ? (id, email, provider) => ops.member(id, email, provider)
        : undefined,
    );
  const provider: AnalysisProvider =
    options.provider ??
    (config.AI_MODE === "live" && state.ready
      ? new OpenAIAnalysisProvider(
          config,
          undefined,
          repo instanceof PostgresRepository
            ? new PostgresKnowledgeRetriever(
                repo,
                config.PUBLIC_LAUNCH_ENABLED === "true",
              )
            : undefined,
        )
      : new MockAnalysisProvider());
  const app = Fastify({ logger: false, bodyLimit: 16384, trustProxy: false });
  const now = options.now ?? Date.now;
  const rates = new Map<string, { count: number; reset: number }>();
  const inflight = new Map<string, AbortController>();
  let active = 0;
  async function limit(key: string, max: number, windowMs: number) {
    if (ops) return ops.rate(key, max, windowMs);
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
        .header(
          "Access-Control-Allow-Headers",
          "Authorization,Content-Type,X-Guest-Token,X-Admin-Request",
        )
        .header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
        .code(204)
        .send();
    await limit(`all:${hash(clientIp(req))}`, 240, 60000);
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
  registerAdmin(
    app,
    config,
    repo instanceof PostgresRepository ? repo : null,
    provider,
  );
  app.get("/api/config", async () => state);
  app.post("/api/buildings", async (req, reply) => {
    const lot = lotSchema.parse(req.body);
    await limit(`building:${hash(clientIp(req))}`, 15, 60000);
    if (!config.BUILDING_API_KEY)
      return reply.code(503).send({
        message: "건물 조회를 준비 중이에요. 주소 없이 계속할 수 있어요.",
      });
    try {
      return await lookupBuilding(config.BUILDING_API_KEY, lot);
    } catch {
      return reply.code(503).send({
        message:
          "건물 정보를 불러오지 못했어요. 다시 시도하거나 주소 없이 계속해 주세요.",
      });
    }
  });
  async function member(req: FastifyRequest) {
    if (!state.account?.enabled || !history)
      throw new AppError("ACCOUNT_NOT_READY", 503);
    const bearer = req.headers.authorization;
    if (!bearer?.startsWith("Bearer "))
      throw new AppError("MEMBER_UNAUTHORIZED", 401);
    return verifyMember(bearer.slice(7));
  }
  app.get("/api/account/history", async (req) => {
    const userId = await member(req);
    return history!.list(userId);
  });
  app.post("/api/account/history", async (req, reply) => {
    const userId = await member(req);
    const body = z
      .object({
        analysisId: z.string().uuid(),
        consentVersion: z.literal(historyConsentVersion),
        editedMessage: z.string().trim().min(1).max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    const token = req.headers["x-guest-token"];
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError("UNAUTHORIZED", 401);
    const owner = await repo.authenticate(hash(token));
    if (!owner) throw new AppError("UNAUTHORIZED", 401);
    const record = await repo.getAnalysis(owner.id, body.analysisId);
    if (!record || record.state !== "complete")
      throw new AppError("NOT_FOUND", 404);
    await history!.save(
      userId,
      record,
      body.editedMessage === undefined
        ? undefined
        : maskPersonalData(body.editedMessage),
    );
    return reply.code(204).send();
  });
  app.delete("/api/account/history/:id", async (req, reply) => {
    const userId = await member(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await history!.remove(userId, id);
    return reply.code(204).send();
  });

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
    await limit(`session:${hash(clientIp(req))}`, 12, 3600000);
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
  app.post("/api/analyses", { bodyLimit: 1300000 }, async (req, reply) => {
    if (!state.ready) throw new AppError("CONFIG_NOT_READY", 503);
    const g = await guest(req);
    const body = analyzeRequestSchema.parse(req.body);
    const input = sanitizeIntake(body.intake);
    await limit(`analysis:${g.id}`, 20, 3600000);
    let confirmedPhoto: PhotoResult | undefined;
    if (body.photoFollowup) {
      const action = body.photoFollowup;
      const previous = await repo.getAnalysis(g.id, action.analysisId);
      const reading = previous?.result?.photoAnalysis;
      if (!previous || !reading || previous.state !== "complete")
        throw new AppError("NOT_FOUND", 404);
      const original = sanitizeIntake(intakeSchema.parse(previous.input));
      if (
        JSON.stringify({
          ...original,
          inputVersion: input.inputVersion,
        }) !== JSON.stringify(input) ||
        ["safety_priority", "out_of_scope"].includes(previous.result!.status)
      )
        throw new AppError("IDEMPOTENCY_CONFLICT", 409);
      if (action.action === "retry") {
        if (
          reading.status !== "failed" ||
          reading.retryAttempted ||
          body.idempotencyKey !== previous.id ||
          previous.digest !==
            hash(JSON.stringify({ input: original, photos: body.photos }))
        )
          throw new AppError("IDEMPOTENCY_CONFLICT", 409);
      } else {
        const deviceIssue =
          input.issue === "boiler" ||
          (input.issue === "fixture" &&
            !["cabinet", "bed"].includes(input.observation));
        const year = action.device.detectedManufactureYear;
        if (
          !deviceIssue ||
          reading.source !== "openai" ||
          !["analyzed", "unclear"].includes(reading.status) ||
          (year !== null && year > new Date(now()).getUTCFullYear())
        )
          throw new AppError("IDEMPOTENCY_CONFLICT", 409);
        const missingPhotoGuide = reading.missingPhotoGuide?.filter(
          (view) =>
            !(view === "display" && action.device.detectedErrorCode) &&
            !(view === "label" && action.device.detectedManufactureYear),
        );
        confirmedPhoto = {
          ...reading,
          userConfirmed: action.device,
          missingPhotoGuide,
        };
      }
    }
    const { record, created } = await repo.createAnalysis(
      g.id,
      body.idempotencyKey,
      hash(
        JSON.stringify({
          input,
          photos: body.photos,
          photoFollowup: body.photoFollowup,
        }),
      ),
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
    let lease: string | undefined;
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
      let photoInputTokens = 0,
        photoOutputTokens = 0;
      let photo = confirmedPhoto;
      if (body.photos)
        photo = {
          status: "skipped",
          source: "none",
          signs: [],
          count: body.photos.images.length,
          missingPhotoGuide: missingPhotoViews(input, body.photos.covered),
        };
      if (hasDanger(input) || outOfScope(intakeContext(input))) {
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
        try {
          if (active >= config.MAX_CONCURRENT)
            throw new AppError("CONCURRENCY_LIMIT", 429);
          if (ops) lease = await ops.lease(config.MAX_CONCURRENT);
          active++;
          counted = true;
          if (
            photo &&
            body.photos &&
            provider.mode === "mock" &&
            !options.readPhoto
          ) {
            photo = { ...photo, status: "mock", source: "mock" };
          }
          if (body.photos && (provider.mode === "live" || options.readPhoto)) {
            try {
              // Separate visual observation call; never sends legal data or stores images.
              const photoTokens = photoTokenBudget;
              const photoUsd = config.DAILY_BUDGET_USD
                ? (photoTokens *
                    Math.max(
                      Number(config.INPUT_USD_PER_MILLION),
                      Number(config.OUTPUT_USD_PER_MILLION),
                    )) /
                  1e6
                : null;
              await repo.reserve(photoTokens, photoUsd, {
                calls: config.MAX_DAILY_CALLS,
                tokens: config.MAX_DAILY_TOKENS,
                usd: config.DAILY_BUDGET_USD
                  ? Number(config.DAILY_BUDGET_USD)
                  : null,
              });
              const reading = await (options.readPhoto ?? photoReader(config))(
                body.photos.images,
                input,
                controller.signal,
                body.photos.covered,
              );
              photo = photoResultSchema.parse({
                ...reading,
                source: options.readPhoto ? "mock" : "openai",
                retryAttempted:
                  body.photoFollowup?.action === "retry" ? true : undefined,
              });
              photoInputTokens = reading.inputTokens ?? 0;
              photoOutputTokens = reading.outputTokens ?? 0;
            } catch (photoError) {
              const status =
                typeof photoError === "object" &&
                photoError !== null &&
                "status" in photoError
                  ? Number(photoError.status)
                  : 0;
              console.warn(
                "PHOTO_ANALYSIS_FAILED",
                Number.isFinite(status) ? status : 0,
              );
              if (controller.signal.aborted)
                throw new AppError("CANCELLED", 409);
              photo = {
                status: "failed",
                source: "none",
                signs: [],
                count: body.photos.images.length,
                missingPhotoGuide: missingPhotoViews(
                  input,
                  body.photos.covered,
                ),
                retryAttempted:
                  body.photoFollowup?.action === "retry" ? true : undefined,
              };
            }
          }
          if (photoDanger(photo)) {
            output = {
              result: makeAnalysis(
                { ...input, safety: "electric" },
                record.id,
                config.AI_MODE,
                "photo-safety-rules",
              ),
              inputTokens: 0,
              outputTokens: 0,
            };
          } else {
            // Retrieval must succeed before reserving an AI call or invoking the model.
            const knowledge = provider.prepare
              ? await provider.prepare(input, controller.signal, photo)
              : undefined;
            if (provider.mode === "live") {
              const tokens = provider.estimate(input, knowledge, photo);
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
            output = await provider.analyze(
              input,
              record.id,
              controller.signal,
              knowledge,
              photo,
            );
          }
        } catch (error) {
          if (controller.signal.aborted) throw new AppError("CANCELLED", 409);
          if (
            provider.mode !== "live" ||
            config.AI_FALLBACK_ENABLED !== "true" ||
            !(error instanceof AppError) ||
            !(fallbackCodes as readonly string[]).includes(error.code)
          )
            throw error;
          output = {
            result: makeFallback(input, record.id, error.code),
            inputTokens: 0,
            outputTokens: 0,
          };
        }
      }
      if (controller.signal.aborted) throw new AppError("CANCELLED", 409);
      const result = analysisSchema.parse({
        ...output.result,
        ...(photo ? { photoAnalysis: photo } : {}),
      });
      if (!(await repo.finish(g.id, record.id, result)))
        throw new AppError("CANCELLED", 409);
      if (!hasDanger(input) && !outOfScope(intakeContext(input)))
        await repo.metric(g.id, {
          event: "analysis_success",
          analysisId: record.id,
          mode: result.mode,
          failureCode: result.fallback?.reason,
          latencyMs: now() - start,
          inputTokens: output.inputTokens + photoInputTokens,
          outputTokens: output.outputTokens + photoOutputTokens,
          costUsd:
            result.fallback && !photoInputTokens
              ? null
              : provider.mode === "mock"
                ? 0
                : config.DAILY_BUDGET_USD
                  ? ((output.inputTokens + photoInputTokens) *
                      Number(config.INPUT_USD_PER_MILLION) +
                      (output.outputTokens + photoOutputTokens) *
                        Number(config.OUTPUT_USD_PER_MILLION)) /
                    1e6
                  : null,
        });
      if (ops)
        await ops
          .event(
            result.fallback
              ? "fallback"
              : result.aiExplanation
                ? "ai_success"
                : "rule_result",
            result.fallback?.reason ?? null,
            result.model,
            now() - start,
          )
          .catch(() => {});
      return result;
    } catch (e) {
      const code = e instanceof AppError ? e.code : "STORAGE_FAILURE";
      await repo.fail(g.id, record.id, code);
      throw e;
    } finally {
      if (counted) active--;
      if (lease && ops) await ops.release(lease).catch(() => {});
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
