import "dotenv/config";
import { z } from "zod";
import type { AppConfig } from "../shared/schema.js";
import { searchSources } from "./sources/catalog.js";
const integer = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const envSchema = z.object({
  AI_MODE: z.enum(["mock", "live"]).default("mock"),
  REPOSITORY: z.enum(["memory", "database"]).default("memory"),
  OPENAI_API_KEY: z.string().default(""),
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
  MAX_OUTPUT_TOKENS: integer(800),
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
  if (c.PUBLIC_LAUNCH_ENABLED === "true")
    blockers.push(
      "공개 운영은 법률·개인정보·플랫폼 검토 전 비활성화되어 있어요.",
    );
  if (c.REPOSITORY === "database" && !c.DATABASE_URL)
    blockers.push("DATABASE_URL 미설정");
  if (c.AI_MODE === "live") {
    if (!c.OPENAI_API_KEY) blockers.push("OPENAI_API_KEY 미설정");
    if (!c.OPENAI_MODEL) blockers.push("OPENAI_MODEL 미설정");
    if (c.REPOSITORY !== "database")
      blockers.push("실제 모드에는 database 저장소가 필요해요.");
    if (c.INTERNAL_LIVE_ENABLED !== "true")
      blockers.push("INTERNAL_LIVE_ENABLED 확인 필요");
    if (c.PROVIDER_RETENTION_ACK !== "true")
      blockers.push("PROVIDER_RETENTION_ACK 확인 필요");
    if (!searchSources("mold").length)
      blockers.push("기술 확인된 내부 검증 자료가 없어요.");
  }
  return {
    ai: c.AI_MODE,
    storage: c.REPOSITORY,
    publicLaunch: false,
    retentionHours: 24,
    ready: !blockers.length,
    blockers,
  };
}
