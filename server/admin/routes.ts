import {
  releaseVersion,
  publicDashboardAllowed,
} from "../../shared/release.js";
import { sourceSchema } from "../../shared/schema.js";
import type { PublicDashboard } from "../../shared/admin.js";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import type { Config } from "../config.js";
import { PostgresRepository } from "../repositories/postgres.js";
import { AdminStore } from "./store.js";
import { Operations } from "../operations.js";
import { AppError } from "../domain/errors.js";
import { datasetVersion } from "../sources/dataset.js";
import type { AnalysisProvider } from "../ai/provider.js";
import { defaultIntake } from "../../shared/schema.js";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function clientIp(req: FastifyRequest) {
  const p = req.headers["x-vercel-forwarded-for"];
  return process.env.VERCEL === "1" &&
    typeof p === "string" &&
    isIP(p.split(",")[0].trim())
    ? p.split(",")[0].trim()
    : req.ip;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, value] = stored.split(":");
  if (!salt || !value || !/^[a-f0-9]{128}$/.test(value)) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(value, "hex"));
}
export function registerAdmin(
  app: FastifyInstance,
  config: Config,
  repo: PostgresRepository | null,
  provider: AnalysisProvider,
) {
  const store = repo ? new AdminStore(repo) : null,
    ops = repo ? new Operations(repo) : null;
  const cookieName =
    config.PUBLIC_LAUNCH_ENABLED === "true"
      ? "__Host-banglog-admin"
      : "banglog-admin";
  const cookie = (value: string, maxAge: number) =>
    `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.PUBLIC_LAUNCH_ENABLED === "true" ? "; Secure" : ""}`;
  const token = (req: FastifyRequest) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : "";
  };
  function ready() {
    if (!store || !ops || !config.ADMIN_PASSWORD_HASH)
      throw new AppError("ADMIN_NOT_READY", 503);
  }
  async function guard(req: FastifyRequest) {
    ready();
    if (req.method !== "GET" && req.headers["x-admin-request"] !== "1")
      throw new AppError("ORIGIN_DENIED", 403);
    const t = token(req);
    if (!t || !(await store!.session(hash(t))))
      throw new AppError("ADMIN_UNAUTHORIZED", 401);
  }
  async function status() {
    let database = "unavailable",
      knowledge = 0,
      lastSuccess: string | null = null,
      lastFailure: string | null = null;
    if (repo)
      try {
        await repo.transaction(
          "00000000-0000-4000-8000-000000000000",
          async (c) => {
            const q = await c.query(
              "select count(*)::int as n from banglog_plus.knowledge_chunks where dataset_version=$1",
              [datasetVersion],
            );
            knowledge = q.rows[0].n;
            const events = await c.query(
              "select max(created_at) filter(where kind in ('ai_success','probe_success')) as success,max(created_at) filter(where kind in ('fallback','probe_failure')) as failure from banglog_plus.operational_events",
            );
            lastSuccess = events.rows[0].success?.toISOString() ?? null;
            lastFailure = events.rows[0].failure?.toISOString() ?? null;
          },
        );
        database = "connected";
      } catch {
        /* Never expose connection errors or credentials. */
      }
    return {
      version: releaseVersion,
      checkedAt: new Date().toISOString(),
      api: "connected",
      database,
      knowledge: { count: knowledge, version: datasetVersion },
      ai: {
        mode: config.AI_MODE,
        model: config.OPENAI_MODEL || null,
        configured: !!config.OPENAI_API_KEY && !!config.OPENAI_MODEL,
        lastSuccess,
        lastFailure,
      },
      login: {
        email: config.MEMBER_HISTORY_ENABLED === "true",
        signup: config.MEMBER_SIGNUP_ENABLED === "true",
        google: false,
        kakao: false,
      },
      legalReview: "pending",
    };
  }
  app.get("/api/status", status);
  let publicCache: { until: number; value: PublicDashboard } | undefined;
  app.get("/api/public/dashboard", async (req) => {
    if (
      !publicDashboardAllowed(
        releaseVersion,
        config.PUBLIC_TEAM_DASHBOARD === "true",
      )
    )
      throw new AppError("NOT_FOUND", 404);
    if (!store || !ops) throw new AppError("ADMIN_NOT_READY", 503);
    await ops.rate("public-dashboard:" + hash(clientIp(req)), 60, 60000);
    if (publicCache && publicCache.until > Date.now()) return publicCache.value;
    const [summary, knowledge] = await Promise.all([
      store.publicSummary(),
      store.knowledge(),
    ]);
    const value: PublicDashboard = {
      version: releaseVersion,
      days: 30,
      checkedAt: new Date().toISOString(),
      usage: summary.usage.map((r) => ({
        day: r.day,
        issue: r.issue,
        mode: r.mode,
        count: r.count,
      })),
      answers: summary.answers.map((r) => ({
        issue: r.issue,
        question: r.question,
        answer: r.answer,
        count: r.count,
      })),
      knowledge: knowledge.map((r) => ({
        id: r.id,
        claim: r.claim,
        content: r.content,
        issues: r.issues,
        source: sourceSchema.parse(r.source),
      })),
    };
    publicCache = { until: Date.now() + 30000, value };
    return value;
  });
  app.post("/api/admin/login", async (req, reply) => {
    ready();
    if (req.headers["x-admin-request"] !== "1")
      throw new AppError("ORIGIN_DENIED", 403);
    await ops!.rate("admin-login:" + hash(clientIp(req)), 8, 900000);
    const { password } = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    if (!passwordMatches(password, config.ADMIN_PASSWORD_HASH))
      throw new AppError("ADMIN_UNAUTHORIZED", 401);
    const t = randomBytes(32).toString("hex");
    await store!.login(hash(t));
    reply.header("Set-Cookie", cookie(t, 28800));
    return { ok: true };
  });
  app.get("/api/admin/session", { preHandler: guard }, async () => ({
    ok: true,
    version: releaseVersion,
  }));
  app.post("/api/admin/logout", { preHandler: guard }, async (req, reply) => {
    await store!.logout(hash(token(req)));
    reply.header("Set-Cookie", cookie("", 0));
    return { ok: true };
  });
  app.get("/api/admin/dashboard", { preHandler: guard }, async (req) => {
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(90).default(30) })
      .parse(req.query);
    return {
      ...(await store!.dashboard(days)),
      limits: {
        calls: config.MAX_DAILY_CALLS,
        tokens: config.MAX_DAILY_TOKENS,
      },
      status: await status(),
    };
  });
  app.get("/api/admin/data-governance", { preHandler: guard }, () =>
    store!.governance(),
  );
  app.get("/api/admin/knowledge", { preHandler: guard }, () =>
    store!.knowledge(),
  );
  app.get("/api/admin/members", { preHandler: guard }, (req) => {
    const { search, page } = z
      .object({
        search: z.string().max(100).default(""),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query);
    return store!.members(search, page);
  });
  app.post("/api/admin/members/:id", { preHandler: guard }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = z
      .object({
        action: z.enum(["block", "unblock", "delete_history"]),
        reason: z.string().trim().min(3).max(200),
        confirm: z.literal(true),
      })
      .strict()
      .parse(req.body);
    await store!.changeMember(id, b.action, b.reason);
    return { ok: true };
  });
  app.get("/api/admin/audit", { preHandler: guard }, () => store!.logs());
  app.post("/api/admin/cleanup", { preHandler: guard }, async () => {
    await ops!.cleanup();
    await store!.run(async (c) => {
      await c.query(
        "delete from banglog_plus.admin_sessions where expires_at<=now()",
      );
      await c.query(
        "delete from banglog_plus.admin_audit where created_at<now()-interval '180 days'",
      );
    });
    await store!.audit("cleanup");
    return { ok: true };
  });
  app.post("/api/admin/check", { preHandler: guard }, async (req) => {
    const { generate } = z
      .object({ generate: z.boolean().default(false) })
      .strict()
      .parse(req.body ?? {});
    await ops!.rate("admin-probe", 4, 60000);
    const start = Date.now();
    let lease: string | undefined;
    try {
      if (!config.OPENAI_API_KEY || !config.OPENAI_MODEL)
        throw new AppError("CONFIG_NOT_READY", 503);
      if (generate) {
        lease = await ops!.lease(config.MAX_CONCURRENT);
        const signal = AbortSignal.timeout(25000);
        const input = {
          ...defaultIntake,
          description:
            "창가 벽지의 곰팡이를 발견했습니다. 원인은 아직 모르고 사진을 기록했습니다.",
          safety: "none" as const,
        };
        const context = await provider.prepare?.(input, signal);
        const tokens = provider.estimate(input, context);
        const usd = config.DAILY_BUDGET_USD
          ? (tokens *
              Math.max(
                Number(config.INPUT_USD_PER_MILLION),
                Number(config.OUTPUT_USD_PER_MILLION),
              )) /
            1e6
          : null;
        await repo!.reserve(tokens, usd, {
          calls: config.MAX_DAILY_CALLS,
          tokens: config.MAX_DAILY_TOKENS,
          usd: config.DAILY_BUDGET_USD ? Number(config.DAILY_BUDGET_USD) : null,
        });
        const result = await provider.analyze(
          input,
          randomUUID(),
          signal,
          context,
        );
        if (result.result.mode !== "live")
          throw new AppError("PROVIDER_FAILURE", 503);
        await ops!.event(
          "probe_success",
          null,
          config.OPENAI_MODEL,
          Date.now() - start,
        );
        await store!.audit("gpt_generation_check");
        return {
          ok: true,
          kind: "generation",
          model: result.result.model,
          sources: result.result.sources.length,
          latencyMs: Date.now() - start,
        };
      }
      const client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        timeout: 8000,
        maxRetries: 0,
      });
      await client.models.retrieve(config.OPENAI_MODEL);
      await store!.audit("gpt_auth_check");
      return {
        ok: true,
        kind: "authentication",
        model: config.OPENAI_MODEL,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      const code = e instanceof AppError ? e.code : "PROVIDER_FAILURE";
      await ops!.event(
        "probe_failure",
        code,
        config.OPENAI_MODEL,
        Date.now() - start,
      );
      throw new AppError(code, 503);
    } finally {
      if (lease) await ops!.release(lease);
    }
  });
  app.get("/api/cron/cleanup", async (req) => {
    if (
      !config.CRON_SECRET ||
      req.headers.authorization !== `Bearer ${config.CRON_SECRET}`
    )
      throw new AppError("UNAUTHORIZED", 401);
    if (!ops) throw new AppError("CONFIG_NOT_READY", 503);
    await ops.cleanup();
    await store!.run(async (c) => {
      await c.query(
        "delete from banglog_plus.admin_sessions where expires_at<=now()",
      );
      await c.query(
        "delete from banglog_plus.admin_audit where created_at<now()-interval '180 days'",
      );
    });
    return { ok: true };
  });
}
