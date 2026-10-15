import { makeAnalysis } from "../../shared/analysis";
import { sanitizeIntake } from "../../shared/safety";
import { feedbackSchema, intakeSchema } from "../../shared/schema";
import type {
  Analysis,
  AppConfig,
  Feedback,
  Intake,
} from "../../shared/schema";

// Hosted demo only: no fetch, cookies, persistent storage or provider credentials.
export function createBrowserDemo() {
  let active = false;
  const results = new Map<string, { input: string; result: Analysis }>();
  const feedback = new Map<string, Feedback>();
  const copied = new Set<string>();
  function requireSession() {
    if (!active) throw new Error("처리 안내를 확인하고 다시 시작해 주세요.");
  }
  function requireResult(id: string) {
    requireSession();
    if (![...results.values()].some(({ result }) => result.analysisId === id))
      throw new Error("현재 세션에서 결과를 찾을 수 없어요.");
  }
  return {
    async config(): Promise<AppConfig> {
      return {
        ai: "mock",
        storage: "browser",
        publicLaunch: false,
        retentionHours: 0,
        ready: true,
        blockers: [],
      };
    },
    async session() {
      active = true;
    },
    async analyze(input: Intake, key: string, signal: AbortSignal) {
      requireSession();
      signal.throwIfAborted();
      const safe = sanitizeIntake(intakeSchema.parse(input));
      const serialized = JSON.stringify(safe);
      const existing = results.get(key);
      if (existing) {
        if (existing.input !== serialized)
          throw new Error("입력이 변경됐어요. 다시 확인해 주세요.");
        return structuredClone(existing.result);
      }
      const result = makeAnalysis(
        safe,
        crypto.randomUUID(),
        "mock",
        "browser-demo-rules",
      );
      results.set(key, { input: serialized, result });
      return structuredClone(result);
    },
    async cancel(key: string) {
      const id = results.get(key)?.result.analysisId;
      if (id) {
        feedback.delete(id);
        copied.delete(id);
      }
      results.delete(key);
    },
    async feedback(id: string, data: Feedback) {
      requireResult(id);
      feedback.set(id, feedbackSchema.parse(data));
    },
    async copied(id: string) {
      requireResult(id);
      copied.add(id);
    },
    async remove() {
      results.clear();
      feedback.clear();
      copied.clear();
      active = false;
    },
    hasSession: () => active,
  };
}
