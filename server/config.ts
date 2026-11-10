import "dotenv/config";
import { z } from "zod";
import type { AppConfig } from "../shared/schema.js";
const integer = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const envSchema = z.object({
  BUILDING_API_KEY: z.string().default(""),
  PUBLIC_TEAM_DASHBOARD: z.enum(["true", "false"]).default("true"),
  ADMIN_PASSWORD_HASH: z.string().default(""),
  CRON_SECRET: z.string().default(""),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_PUBLISHABLE_KEY: z.string().default(""),
  MEMBER_SIGNUP_ENABLED: z.string().default("false"),
  MEMBER_HISTORY_ENABLED: z.string().default("false"),
  GOOGLE_LOGIN_ENABLED: z.string().default("false"),
  KAKAO_LOGIN_ENABLED: z.string().default("false"),
  AI_MODE: z.enum(["mock", "live"]).default("mock"),
  REPOSITORY: z.enum(["memory", "database"]).default("memory"),
  OPENAI_API_KEY: z.string().default(""),
  AI_FALLBACK_ENABLED: z.enum(["true", "false"]).default("true"),
  OPENAI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(30000),
  OPENAI_MODEL: z.string().default(""),
  DATABASE_URL: z.string().default(""),
  DATABASE_SSL: z.enum(["require", "disable"]).default("require"),
  INTERNAL_LIVE_ENABLED: z.string().default("false"),
  PROVIDER_RETENTION_ACK: z.string().default("false"),
  PUBLIC_LAUNCH_ENABLED: z.string().default("false"),
  PORT: integer(8787),
  HOST: z.string().default("127.0.0.1"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://127.0.0.1:5173,http://localhost:5173"),
  MAX_DAILY_CALLS: integer(30),
  MAX_DAILY_TOKENS: integer(300000),
  MAX_CONCURRENT: integer(2),
  MAX_OUTPUT_TOKENS: integer(1800),
  INPUT_USD_PER_MILLION: z.string().default(""),
  OUTPUT_USD_PER_MILLION: z.string().default(""),
  DAILY_BUDGET_USD: z.string().default(""),
});
export type Config = z.infer<typeof envSchema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = envSchema.parse(env);
  if (
    c.DATABASE_URL &&
    c.DATABASE_SSL === "disable" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(c.DATABASE_URL).hostname,
    )
  )
    throw new Error("TLS_REQUIRED");
  if (
    c.SUPABASE_URL &&
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.SUPABASE_URL)
  )
    throw new Error("INVALID_SUPABASE_URL");
  if (
    c.SUPABASE_PUBLISHABLE_KEY &&
    !c.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")
  )
    throw new Error("PUBLISHABLE_KEY_REQUIRED");
  const prices = [
    c.INPUT_USD_PER_MILLION,
    c.OUTPUT_USD_PER_MILLION,
    c.DAILY_BUDGET_USD,
  ];
  if (
    prices.some(Boolean) &&
    (!prices.every(Boolean) ||
      prices.some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0))
  )
    throw new Error("INVALID_BUDGET_CONFIGURATION");
  return c;
}
export function publicConfig(c: Config): AppConfig {
  const blockers: string[] = [];
  if (c.REPOSITORY === "database" && !c.DATABASE_URL)
    blockers.push("DATABASE_URL 미설정");
  if (c.AI_MODE === "live") {
    if (!c.OPENAI_API_KEY) blockers.push("OPENAI_API_KEY 미설정");
    if (!c.OPENAI_MODEL) blockers.push("OPENAI_MODEL 미설정");
    if (c.REPOSITORY !== "database")
      blockers.push("실제 모드에는 database 저장소가 필요해요.");
    if (
      c.INTERNAL_LIVE_ENABLED !== "true" &&
      c.PUBLIC_LAUNCH_ENABLED !== "true"
    )
      blockers.push("INTERNAL_LIVE_ENABLED 확인 필요");
    if (c.PROVIDER_RETENTION_ACK !== "true")
      blockers.push("PROVIDER_RETENTION_ACK 확인 필요");
  }
  return {
    account: {
      enabled:
        c.MEMBER_HISTORY_ENABLED === "true" &&
        c.REPOSITORY === "database" &&
        !!c.DATABASE_URL &&
        !!c.SUPABASE_URL &&
        !!c.SUPABASE_PUBLISHABLE_KEY,
      url: c.SUPABASE_URL,
      publishableKey: c.SUPABASE_PUBLISHABLE_KEY,
      google: c.GOOGLE_LOGIN_ENABLED === "true",
      kakao: c.KAKAO_LOGIN_ENABLED === "true",
      signup: c.MEMBER_SIGNUP_ENABLED === "true",
      retentionDays: 90,
    },
    ai: c.AI_MODE,
    storage: c.REPOSITORY,
    publicLaunch: c.PUBLIC_LAUNCH_ENABLED === "true",
    retentionHours: 24,
    ready: !blockers.length,
    blockers,
  };
}
