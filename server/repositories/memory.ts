import { randomUUID } from "node:crypto";
import type { Analysis, Feedback, Intake } from "../../shared/schema.js";
import { AppError } from "../domain/errors.js";
import type {
  AnalysisRecord,
  BudgetLimits,
  Guest,
  Metric,
  Repository,
} from "./types.js";
export class MemoryRepository implements Repository {
  kind = "memory" as const;
  guests = new Map<string, Guest>();
  records = new Map<string, AnalysisRecord>();
  feedbacks = new Map<string, Feedback>();
  metrics = new Map<string, { owner: string; data: Metric }>();
  budget = { day: "", calls: 0, tokens: 0, usd: 0 };
  constructor(private now: () => number = Date.now) {}
  private active(owner: string) {
    const guest = this.guests.get(owner);
    return guest && guest.expiresAt > this.now();
  }
  async createGuest(tokenHash: string, consentVersion: string) {
    const g = {
      id: randomUUID(),
      tokenHash,
      expiresAt: this.now() + 86400000,
      consentVersion,
    };
    this.guests.set(g.id, g);
    return g;
  }
  async authenticate(hash: string) {
    return (
      [...this.guests.values()].find(
        (g) => g.tokenHash === hash && g.expiresAt > this.now(),
      ) ?? null
    );
  }
  async createAnalysis(
    owner: string,
    key: string,
    digest: string,
    input: Intake,
  ) {
    if (!this.active(owner)) throw new AppError("UNAUTHORIZED", 401);
    const previous = [...this.records.values()].find(
      (r) =>
        r.owner === owner &&
        (r.key === key || r.input.inputVersion === input.inputVersion),
    );
    if (previous) {
      if (previous.digest !== digest)
        throw new AppError("IDEMPOTENCY_CONFLICT", 409);
      return { record: previous, created: false };
    }
    const record: AnalysisRecord = {
      id: randomUUID(),
      owner,
      key,
      digest,
      input,
      state: "pending",
      result: null,
      failureCode: null,
    };
    this.records.set(record.id, record);
    return { record, created: true };
  }
  async getAnalysis(owner: string, id: string) {
    const r = this.records.get(id);
    return this.active(owner) && r?.owner === owner ? r : null;
  }
  async finish(owner: string, id: string, result: Analysis) {
    const r = await this.getAnalysis(owner, id);
    if (!r || r.state !== "pending") return false;
    r.state = "complete";
    r.result = result;
    return true;
  }
  async fail(owner: string, id: string, code: string) {
    const r = await this.getAnalysis(owner, id);
    if (r?.state === "pending") {
      r.state = "failed";
      r.failureCode = code;
    }
  }
  async cancel(owner: string, key: string) {
    for (const r of this.records.values())
      if (r.owner === owner && r.key === key && r.state === "pending")
        r.state = "cancelled";
  }
  async deleteGuest(owner: string) {
    this.guests.delete(owner);
    for (const [id, r] of this.records)
      if (r.owner === owner) {
        this.records.delete(id);
        this.feedbacks.delete(id);
      }
    for (const [id, m] of this.metrics)
      if (m.owner === owner) this.metrics.delete(id);
  }
  async feedback(owner: string, id: string, data: Feedback) {
    const r = await this.getAnalysis(owner, id);
    if (!r || r.state !== "complete") throw new AppError("NOT_FOUND", 404);
    this.feedbacks.set(id, data);
  }
  async metric(owner: string, data: Metric) {
    if (!this.active(owner)) throw new AppError("UNAUTHORIZED", 401);
    if (data.analysisId && !(await this.getAnalysis(owner, data.analysisId)))
      throw new AppError("NOT_FOUND", 404);
    this.metrics.set(`${owner}:${data.analysisId ?? "session"}:${data.event}`, {
      owner,
      data,
    });
  }
  async reserve(tokens: number, usd: number | null, limits: BudgetLimits) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (this.budget.day !== day)
      this.budget = { day, calls: 0, tokens: 0, usd: 0 };
    if (
      this.budget.calls + 1 > limits.calls ||
      this.budget.tokens + tokens > limits.tokens ||
      (limits.usd !== null && this.budget.usd + (usd ?? 0) > limits.usd)
    )
      throw new AppError("BUDGET_LIMIT", 429);
    this.budget.calls++;
    this.budget.tokens += tokens;
    this.budget.usd += usd ?? 0;
  }
  async cleanup() {
    let n = 0;
    for (const g of this.guests.values())
      if (g.expiresAt <= this.now()) {
        await this.deleteGuest(g.id);
        n++;
      }
    return n;
  }
  async seedSources() {}
  async close() {}
}
