import type { Issue, LegalSource } from "./schema.js";
export type ConnectionStatus = {
  version: string;
  checkedAt: string;
  api: string;
  database: string;
  knowledge: { count: number; version: string };
  ai: {
    mode: string;
    model: string | null;
    configured: boolean;
    lastSuccess: string | null;
    lastFailure: string | null;
  };
  login: { email: boolean; google: boolean; kakao: boolean };
  legalReview: string;
};
export type Dashboard = {
  days: number;
  usage: { day: string; issue: Issue; mode: string; count: number }[];
  answers: { issue: Issue; question: string; answer: string; count: number }[];
  operations: {
    kind: string;
    code: string | null;
    count: number;
    latency: number | null;
  }[];
  budget: { day: string; calls: number; tokens: number; usd: string }[];
  members: { total: number; blocked: number };
  limits: { calls: number; tokens: number };
  status: ConnectionStatus;
};
export type KnowledgeRow = {
  id: string;
  claim: string;
  content: string;
  issues: Issue[];
  source: LegalSource & {
    verification?: {
      caseNumber: string;
      decisionDate: string;
      primaryUrl: string;
      crossCheckUrl: string;
      method: string;
      limitations: string;
      status: string;
    };
  };
};
export type MemberRow = {
  user_id: string;
  email: string | null;
  provider: string | null;
  status: "active" | "blocked";
  created_at: string;
  last_seen_at: string;
  history_count: number;
};
export type AuditRow = {
  action: string;
  target: string | null;
  reason: string | null;
  created_at: string;
};

export type PublicDashboard = {
  version: string;
  days: number;
  checkedAt: string;
  usage: Dashboard["usage"];
  answers: Dashboard["answers"];
  knowledge: KnowledgeRow[];
};

export interface DataGovernance {
  datasets: Array<{
    id: string;
    title: string;
    provider: string;
    catalog_url: string;
    license_status: "confirmed" | "pending";
    storage_allowed: boolean;
    external_llm_allowed: boolean;
    purpose: string;
    limitation: string;
    checked_at: string;
  }>;
  candidates: Array<{
    dataset_id: string;
    document_type: string;
    review_status: string;
    count: number;
  }>;
  eligibility: {
    versions: number;
    public_eligible: number;
    official_general?: number;
  };
}
