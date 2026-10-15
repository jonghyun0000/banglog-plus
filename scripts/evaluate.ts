import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { intakeSchema, consentVersion } from "../shared/schema.js";
import type { Analysis, AppConfig } from "../shared/schema.js";
import { sanitizeIntake } from "../shared/safety.js";
import { MockAnalysisProvider } from "../server/ai/provider.js";
import { loadConfig, publicConfig } from "../server/config.js";
const live = process.argv.includes("--live");
const config = loadConfig();
const limitArg = process.argv.find((a) => a.startsWith("--max-calls="));
const cap = limitArg ? Number(limitArg.split("=")[1]) : 0;
if (
  live &&
  (!publicConfig(config).ready ||
    config.AI_MODE !== "live" ||
    !Number.isInteger(cap) ||
    cap < 1 ||
    cap > 5)
)
  throw new Error(
    "Live evaluation requires ready live config and explicit --max-calls=1..5",
  );
const data = await readFile("fixtures/scenarios.json", "utf8");
const fixtures = JSON.parse(data) as {
  id: string;
  split: string;
  input: unknown;
  expectedSoftwareInvariant: { direction: string; status: string };
}[];
const provider = new MockAnalysisProvider();
const results: {
  id: string;
  split: string;
  passed: boolean;
  error?: string;
}[] = [];
let token = "";
const base = `http://127.0.0.1:${config.PORT}/api`;
async function call<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    const e = (await r.json()) as { code: string };
    throw new Error(e.code);
  }
  return r.status === 204 ? (undefined as T) : (r.json() as Promise<T>);
}
try {
  if (live) {
    const state = await call<AppConfig>("/config", undefined, "GET");
    if (!state.ready || state.ai !== "live" || state.storage !== "database")
      throw new Error("API_NOT_LIVE");
    token = (
      await call<{ token: string }>("/sessions", {
        noticeAccepted: true,
        consentVersion,
      })
    ).token;
  }
  const selected = live
    ? fixtures.filter((f) => f.split === "development").slice(0, cap)
    : fixtures;
  for (const [index, f] of selected.entries()) {
    const input = sanitizeIntake(intakeSchema.parse(f.input));
    input.inputVersion = index + 1;
    try {
      const result = live
        ? await call<Analysis>("/analyses", {
            intake: input,
            idempotencyKey: randomUUID(),
          })
        : (
            await provider.analyze(
              input,
              randomUUID(),
              new AbortController().signal,
            )
          ).result;
      results.push({
        id: f.id,
        split: f.split,
        passed:
          result.costResponsibility.direction ===
            f.expectedSoftwareInvariant.direction &&
          result.status === f.expectedSoftwareInvariant.status,
      });
    } catch (e) {
      results.push({
        id: f.id,
        split: f.split,
        passed: false,
        error: e instanceof Error ? e.message : "FAILED",
      });
      if (live) break;
    }
  }
} finally {
  if (token) await call("/session", undefined, "DELETE");
}
const report = {
  evaluatedAt: new Date().toISOString(),
  mode: live ? "live" : "mock",
  fixtureSha256: createHash("sha256").update(data).digest("hex"),
  scope:
    "Software invariants only; not legal accuracy; holdout not used to tune",
  count: results.length,
  passed: results.filter((r) => r.passed).length,
  results,
};
await writeFile(
  `docs/${live ? "live-" : ""}evaluation-results.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.info(
  JSON.stringify({
    count: report.count,
    passed: report.passed,
    fixtureSha256: report.fixtureSha256,
  }),
);
if (report.passed !== report.count) process.exitCode = 1;
