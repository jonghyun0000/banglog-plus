import type { Analysis, Direction, Intake } from "./schema.js";
import { analysisSchema, issueNames } from "./schema.js";
import { answerLabel, observationLabel, questionVersion } from "./questions.js";
import { hasDanger, outOfScope, safetyText } from "./safety.js";
export const ruleVersion = "rules-1.0";
export function directionFor(i: Intake): Direction {
  if (
    hasDanger(i) ||
    outOfScope(i.description) ||
    conflictFor(i).length ||
    i.contract.trim()
  )
    return "undetermined";
  if (i.causeSource !== "technician") return "undetermined";
  if (i.cause === "mixed") return "mixed";
  if (i.cause === "damage") return "tenant";
  if (i.cause === "aging" && i.installed === "original") return "landlord";
  return "undetermined";
}
export function conflictFor(i: Intake) {
  return i.otherClaim !== "none" &&
    i.otherClaim !== "unknown" &&
    i.cause !== "unknown" &&
    i.otherClaim !== i.cause
    ? [
        "전달된 원인 설명이 서로 달라요. 점검 결과와 각 설명의 근거를 대조해야 해요.",
      ]
    : [];
}
export function makeAnalysis(
  i: Intake,
  id: string,
  mode: "mock" | "live",
  model: string,
): Analysis {
  const danger = hasDanger(i),
    outside = outOfScope(i.description),
    direction = directionFor(i);
  const third = i.cause === "third" || i.otherClaim === "third";
  const uncertain =
    "입력은 사용자 진술이며, 기사에게 들은 설명도 원본 점검 기록으로 검증하지 않았어요. 원인·수리 범위·계약에 따라 비용이 달라질 수 있어요.";
  const conditions: Record<Direction, string[]> = {
    landlord: [
      "집에 원래 있던 시설의 노후·결함으로 필요한 수리라는 점이 점검으로 확인되고, 다른 원인이나 유효한 비용 약정이 없는 경우를 전제로 해요.",
    ],
    tenant: [
      "사용 중 파손·관리와 고장의 인과관계가 확인되는 경우 세입자 부담을 검토해요. 단순한 집주인 주장만으로 확정하지 않아요.",
    ],
    mixed: [
      "시설 문제와 사용·관리 요인이 함께 확인되는 경우 각 원인과 수리 범위를 구분해요. 복합 원인이 비용 50:50을 뜻하지 않아요.",
    ],
    undetermined: [
      danger
        ? "위험을 먼저 해소한 뒤 원인과 비용을 확인하세요."
        : outside
          ? "이 서비스는 대한민국 주택의 곰팡이·누수·보일러 문제만 다뤄요."
          : third
            ? "윗집·공용부분 등 원인 위치와 관리 주체를 확인해야 해요."
            : i.contract
              ? "입력한 계약 문장의 적용 범위·유효성과 실제 원인을 함께 확인해야 해요."
              : "누가 부담할지 가르는 원인과 점검 기록이 더 필요해요.",
    ],
  };
  const checks = [
    third
      ? "누수·고장 발생 지점이 전용부분인지 공용부분인지 확인하기"
      : "점검 담당자에게 원인과 필요한 수리 범위를 기록으로 요청하기",
    "관련 계약 문장과 입주 당시 상태 확인하기",
  ];
  const messageKind =
    i.contact === "cost"
      ? "cost"
      : ["waiting", "replied"].includes(i.contact)
        ? "followup"
        : "initial";
  const opening =
    messageKind === "followup"
      ? `안녕하세요. 앞서 연락드린 ${issueNames[i.issue]} 문제의 점검 일정과 진행 상황을 확인하고 싶습니다.`
      : `안녕하세요. ${issueNames[i.issue]} 문제로 점검이 필요해 연락드립니다.`;
  const message = `${opening}\n${messageKind === "cost" ? "안내받은 비용의 산정 기준과 점검 결과를 알려주실 수 있을까요?" : "점검 일정과 수리 진행 방법을 안내해 주실 수 있을까요?"}\n${third ? "공용부분이나 다른 세대와 관련이 있는지도 확인 부탁드립니다.\n" : ""}원인과 수리 범위를 확인한 뒤 비용 부담을 협의하고 싶습니다.`;
  return analysisSchema.parse({
    schemaVersion: "1.0",
    analysisId: id,
    inputVersion: i.inputVersion,
    audience: "tenant",
    mode,
    status: danger
      ? "safety_priority"
      : outside
        ? "out_of_scope"
        : direction === "undetermined"
          ? "needs_information"
          : "complete",
    userReportedFacts: [
      {
        key: "description",
        value: i.description || "별도 설명 없음",
        provenance: "tenant_report",
      },
      {
        key: "observation",
        value: observationLabel(i),
        provenance: "tenant_report",
      },
      ...(["discovered", "preexisting", "installed", "contact"] as const).map(
        (key) => ({
          key,
          value: answerLabel(key, i[key]),
          provenance: "tenant_report",
        }),
      ),
      {
        key: "cause",
        value: answerLabel("cause", i.cause),
        provenance:
          i.causeSource === "technician"
            ? "relayed_technician"
            : i.causeSource === "landlord"
              ? "landlord_claim"
              : i.causeSource === "self"
                ? "tenant_report"
                : "unknown",
      },
      {
        key: "otherClaim",
        value: answerLabel("otherClaim", i.otherClaim),
        provenance: "landlord_claim",
      },
      {
        key: "contract",
        value: i.contract || "계약 문구 미확인",
        provenance: "tenant_report",
      },
    ],
    unknownFacts: [
      ...(i.cause === "unknown" ? ["고장·손상의 실제 원인"] : []),
      "원본 점검 기록",
      ...(i.contract ? [] : ["관련 수리 약정의 내용"]),
    ],
    conflictingFacts: conflictFor(i),
    repairRequest: {
      recipient: danger ? "emergency" : third ? "manager" : "landlord",
      reason: danger
        ? safetyText
        : outside
          ? "곰팡이·누수·보일러 외의 법률 문제는 해당 분야의 별도 상담에서 확인해 주세요."
          : third
            ? "관리 담당자에게 발생 위치와 공용부분 여부의 점검을 요청하고, 집주인에게도 상황을 알려주세요."
            : "집주인에게 현재 상황을 알리고 점검·수리 진행 방법을 먼저 요청하세요. 요청 상대와 최종 비용 부담자는 다를 수 있어요.",
      immediateAction: danger ? safetyText : checks[0],
    },
    costResponsibility: {
      direction,
      conditions: conditions[direction],
      uncertainty: uncertain,
    },
    citedClaims: [],
    sources: [],
    additionalChecks: checks,
    otherPartyCheckRequired: third,
    nextActions: danger
      ? [
          "안전한 장소로 이동하기",
          "안전한 곳에서 119에 도움 요청하기",
          "안전 확인 전 자가 수리하지 않기",
        ]
      : outside
        ? [
            "지원 범위에 맞는 문제인지 다시 확인하기",
            "범위 밖 법률 문제는 별도 전문 상담으로 확인하기",
          ]
        : [
            i.issue === "mold"
              ? "발생 위치·시점·결로 양상을 기록하기"
              : i.issue === "leak"
                ? "안전한 거리에서 물이 새는 위치·시점을 기록하기"
                : "보이는 오류 표시와 작동하지 않는 기능을 기록하기",
            checks[0],
            "점검 일정과 비용 협의 방법을 연락하기",
          ],
    messageDraft: danger || outside ? "" : message,
    messageKind,
    cautions: [
      mode === "mock"
        ? "데모: 가상 결과이며 실제 AI 분석이나 법률 판단이 아니에요."
        : "AI 보조 안내이며 법적 판단을 확정하지 않아요. 사람의 법률 검토 전 내부 검증용이에요.",
      "임의로 임대료를 중단하거나 보증금에서 수리비를 공제하지 마세요.",
    ],
    questionVersion,
    ruleVersion,
    promptVersion: "bounded-plan-1.0",
    model,
    generatedAt: new Date().toISOString(),
  });
}
