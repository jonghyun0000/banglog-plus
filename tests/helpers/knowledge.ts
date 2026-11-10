import type { Intake } from "../../shared/schema.js";
import {
  datasetChunks,
  datasetSources,
  datasetVersion,
} from "../../server/sources/dataset.js";
import type { RetrievedKnowledge } from "../../server/sources/retrieval.js";
import { validatePlan as validateRetrievedPlan } from "../../server/ai/provider.js";

// Unit tests only. Production OpenAI providers use PostgresKnowledgeRetriever.
export function knowledgeFixture(input: Intake): RetrievedKnowledge {
  return {
    datasetVersion,
    method: "postgres-filter-keyword-1",
    passages: datasetChunks
      .filter((p) => p.issues.includes(input.issue))
      .map((p) => ({
        id: p.id,
        claimId: p.claimId,
        claim: p.claim,
        text: p.text,
        source: datasetSources.find(
          (s) => s.id === p.sourceId && s.version === p.sourceVersion,
        )!,
      })),
  };
}
export const fixtureRetriever = {
  retrieve: async (input: Intake) => knowledgeFixture(input),
};
export function validatePlan(
  value: unknown,
  input: Intake,
  id: string,
  model: string,
) {
  return validateRetrievedPlan(
    value,
    input,
    id,
    model,
    knowledgeFixture(input),
  );
}

export function tailoredPlan(claimId = "maintenance") {
  return {
    summary:
      "전달된 수리 상황을 바탕으로 점검 기록부터 확인하되 비용 부담은 아직 확정할 수 없어요.",
    steps: [
      {
        title: "점검 내용 요청하기",
        action:
          "집주인에게 고장 원인과 필요한 수리 범위를 기록으로 요청해 보세요.",
        reason:
          "시설 유지 의무의 적용 여부는 실제 사용 지장과 원인 확인이 필요해요.",
        factKeys: ["contact", "observation"],
        missingEvidence: ["원본 점검 기록"],
        claimIds: [claimId],
      },
      {
        title: "입주 당시 상태 대조하기",
        action:
          "입주 기록과 현재 상태를 비교해 기존 손상이 있었는지 확인해 보세요.",
        reason:
          "일반 원칙만으로 이번 손상 책임을 확정할 수 없어 사실 확인이 필요해요.",
        factKeys: ["preexisting"],
        missingEvidence: ["입주 당시 기록"],
        claimIds: [claimId],
      },
    ],
  };
}
