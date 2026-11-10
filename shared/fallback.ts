import type { Analysis, Intake } from "./schema.js";
import { makeAnalysis } from "./analysis.js";
import { issueGuidance } from "./questions.js";
export const fallbackCodes = [
  "PROVIDER_TIMEOUT",
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_FAILURE",
  "PROVIDER_OUTPUT",
  "PROVIDER_REFUSAL",
  "KNOWLEDGE_NOT_READY",
  "KNOWLEDGE_NOT_FOUND",
  "KNOWLEDGE_INVALID",
  "BUDGET_LIMIT",
  "CONCURRENCY_LIMIT",
] as const;
export function makeFallback(
  input: Intake,
  id: string,
  reason: string,
): Analysis {
  const result = makeAnalysis(input, id, "mock", "offline-rules-1");
  result.fallback = {
    reason,
    notice: reason.startsWith("KNOWLEDGE_")
      ? "이 상황에 사용할 근거 자료를 충분히 확인하지 못해 기본 안내를 보여드려요. GPT 분석 결과가 아니며, 원인과 비용 부담을 판단하지 않아요."
      : "AI 분석을 완료하지 못해 준비된 기본 안내를 보여드려요. 아래 내용은 GPT의 분석 결과가 아니며, 원인과 비용 부담은 추가 확인이 필요해요.",
  };
  result.promptVersion = "fallback-rules-1";
  result.citedClaims = [];
  result.sources = [];
  result.costResponsibility = {
    direction: "undetermined",
    conditions: [
      "실제 고장 원인과 입주 당시 상태, 점검 기록을 먼저 확인해 주세요.",
    ],
    uncertainty:
      "기본 안내만으로 집주인이나 세입자의 비용 부담을 결정할 수 없어요.",
  };
  result.status = "needs_information";
  result.nextActions = result.drainGuide
    ? result.drainGuide.steps.map((s) => s.body)
    : [
        issueGuidance[input.issue].record,
        ...issueGuidance[input.issue].checks,
      ].slice(0, 3);
  result.cautions = [
    "AI 연결 또는 답변 검증이 완료되지 않은 기본 안내예요.",
    "실제 원인과 계약 내용을 확인한 뒤 수리 진행 방법과 비용을 협의하세요.",
  ];
  return result;
}
