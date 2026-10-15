import type {
  Analysis,
  EventName,
  Feedback,
  Intake,
  LegalSource,
} from "../../shared/schema.js";
export type Guest = {
  id: string;
  tokenHash: string;
  expiresAt: number;
  consentVersion: string;
};
export type RecordState = "pending" | "complete" | "cancelled" | "failed";
export type AnalysisRecord = {
  id: string;
  owner: string;
  key: string;
  digest: string;
  input: Intake;
  state: RecordState;
  result: Analysis | null;
  failureCode: string | null;
};
export type BudgetLimits = {
  calls: number;
  tokens: number;
  usd: number | null;
};
export type Metric = {
  event: EventName;
  analysisId?: string;
  mode: "mock" | "live";
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  failureCode?: string;
  costUsd?: number | null;
};
export interface Repository {
  kind: "memory" | "database";
  createGuest(hash: string, consent: string): Promise<Guest>;
  authenticate(hash: string): Promise<Guest | null>;
  createAnalysis(
    owner: string,
    key: string,
    digest: string,
    input: Intake,
  ): Promise<{ record: AnalysisRecord; created: boolean }>;
  getAnalysis(owner: string, id: string): Promise<AnalysisRecord | null>;
  finish(owner: string, id: string, result: Analysis): Promise<boolean>;
  fail(owner: string, id: string, code: string): Promise<void>;
  cancel(owner: string, key: string): Promise<void>;
  deleteGuest(owner: string): Promise<void>;
  feedback(owner: string, id: string, data: Feedback): Promise<void>;
  metric(owner: string, data: Metric): Promise<void>;
  reserve(
    tokens: number,
    usd: number | null,
    limits: BudgetLimits,
  ): Promise<void>;
  cleanup(): Promise<number>;
  seedSources(sources: LegalSource[]): Promise<void>;
  close(): Promise<void>;
}
