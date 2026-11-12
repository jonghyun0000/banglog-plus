import { buildingFacts, buildingGuide } from "./building.js";
import { isLightingIssue, lightingRoute } from "./lighting.js";
import { drainGuide, drainFacts, drainMessage } from "./drain.js";
import type { Analysis, Direction, Intake } from "./schema.js";
import { analysisSchema, intakeIssueName } from "./schema.js";
import {
  answerLabel,
  observationLabel,
  questionVersion,
  repairGuidance,
  intakeDetails,
} from "./questions.js";
import { hasDanger, outOfScope, safetyText, intakeContext } from "./safety.js";
export const ruleVersion = "rules-1.2";
export function directionFor(i: Intake): Direction {
  if (
    hasDanger(i) ||
    outOfScope(intakeContext(i)) ||
    conflictFor(i).length ||
    i.contract.trim()
  )
    return "undetermined";
  if (
    ["surface", "drain", "fixture"].includes(i.issue) &&
    (i.preexisting === "yes" || i.installed === "own" || i.installed === "na")
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
    outside = outOfScope(intakeContext(i)),
    direction = directionFor(i);
  const third = i.cause === "third" || i.otherClaim === "third";
  const ownFixture = i.issue === "fixture" && i.installed === "own" && !third;
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
          ? "이 서비스는 대한민국 주택의 곰팡이·누수·보일러·벽지/장판·배수·전구/조명·옵션 제품 문제를 다뤄요."
          : third
            ? "윗집·공용부분 등 원인 위치와 관리 주체를 확인해야 해요."
            : i.contract
              ? "입력한 계약 문장의 적용 범위·유효성과 실제 원인을 함께 확인해야 해요."
              : "누가 부담할지 가르는 원인과 점검 기록이 더 필요해요.",
    ],
  };
  const buildingCare =
    danger || outside ? undefined : buildingGuide(i.building, ownFixture);
  const care = outside ? undefined : drainGuide(i);
  if (care && buildingCare) {
    care.steps[1] = {
      title:
        care.route === "self_check"
          ? `해결되지 않으면 · ${buildingCare.contactTitle}`
          : buildingCare.contactTitle,
      body: buildingCare.contactSteps.slice(0, 2).join(" "),
    };
  }
  const guidance = repairGuidance(i);
  const checks = [
    third
      ? "누수·고장 발생 지점이 전용부분인지 공용부분인지 확인하기"
      : "점검 담당자에게 원인과 필요한 수리 범위를 기록으로 요청하기",
    ...guidance.checks,
    "관련 계약 문장과 입주 당시 상태 확인하기",
  ];
  const recipient = danger
    ? "emergency"
    : (buildingCare?.recipient ??
      (third ? "manager" : ownFixture ? "service" : "landlord"));
  const messageKind = ownFixture
    ? "initial"
    : i.contact === "cost"
      ? "cost"
      : ["waiting", "replied"].includes(i.contact)
        ? "followup"
        : "initial";
  const message = repairMessage(i, recipient, messageKind);
  return analysisSchema.parse({
    drainGuide: care,
    buildingGuide: buildingCare,
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
      ...drainFacts(i),
      ...buildingFacts(i.building),
      ...intakeDetails(i).map(([label, value]) => ({
        key: label,
        value,
        provenance:
          label === "사용자가 전한 기사 소견"
            ? ("relayed_technician" as const)
            : label === "사용자가 전한 상대방 답변"
              ? ("landlord_claim" as const)
              : ("tenant_report" as const),
      })),
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
      recipient,
      reason:
        buildingCare && care?.route !== "stop"
          ? `${care?.route === "self_check" ? "간단한 확인으로 해결되지 않거나 직접 확인하기 어렵다면 " : ""}${buildingCare.contactSteps[0]}`
          : care
            ? care.route === "self_check"
              ? "간단한 확인으로 해결되지 않으면 집주인·관리 담당자에게 연락하세요. 직접 조치를 하기 어렵다면 먼저 점검을 요청해도 괜찮아요."
              : care.steps[1].body
            : danger
              ? safetyText
              : outside
                ? "지원하는 주택 수리 범위 밖의 법률 문제는 해당 분야의 별도 상담에서 확인해 주세요."
                : third
                  ? "관리 담당자에게 발생 위치와 공용부분 여부의 점검을 요청하고, 집주인에게도 상황을 알려주세요."
                  : ownFixture
                    ? "직접 소유한 제품은 제조사·수리업체에 점검과 보증 적용 여부를 문의하세요. 누수 등으로 집의 시설에도 영향이 있다면 집주인에게 상황을 알려주세요."
                    : "집주인에게 현재 상황을 알리고 점검·수리 진행 방법을 먼저 요청하세요. 요청 상대와 최종 비용 부담자는 다를 수 있어요.",
      immediateAction: danger ? safetyText : (care?.steps[0].body ?? checks[0]),
    },
    costResponsibility: {
      direction,
      conditions: [
        ...conditions[direction],
        ...(danger || outside
          ? []
          : [
              guidance.note,
              ...(i.cause === "wear"
                ? [
                    "통상 마모인지 별도 훼손인지, 사용 기간과 수리 범위를 함께 확인해야 해요. 일정 비율로 자동 계산하지 않아요.",
                  ]
                : []),
              ...(["surface", "drain", "fixture"].includes(i.issue) &&
              i.preexisting === "yes"
                ? [
                    "입주 전부터 있었다는 진술은 입주 기록과 대조해야 해요. 현재 사용자에게 새 손상 책임을 바로 연결하지 않아요.",
                  ]
                : []),
              ...(i.installed === "own"
                ? [
                    "직접 설치·소유한 제품은 주택에 포함된 옵션과 구분해 제조사·설치업체의 점검 및 보증도 확인하세요.",
                  ]
                : []),
            ]),
      ],
      uncertainty: uncertain,
    },
    citedClaims: [],
    sources: [],
    additionalChecks: checks,
    otherPartyCheckRequired: third,
    nextActions: care
      ? care.steps.map((s) => s.body)
      : danger
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
              guidance.record,
              guidance.checks[0],
              "점검 일정과 비용 협의 방법을 연락하기",
            ],
    messageDraft: danger || outside ? "" : message,
    messageKind,
    cautions: [
      mode === "mock"
        ? "데모: 가상 결과이며 실제 AI 분석이나 법률 판단이 아니에요."
        : "AI 보조 안내이며 법적 판단을 확정하지 않아요. 법률가 검토 전 자료를 참고한 안내이므로 구체적인 분쟁은 전문가와 확인해 주세요.",
      "임의로 임대료를 중단하거나 보증금에서 수리비를 공제하지 마세요.",
    ],
    questionVersion,
    ruleVersion,
    promptVersion: "bounded-plan-1.0",
    model,
    generatedAt: new Date().toISOString(),
  });
}

export function repairMessage(
  i: Intake,
  recipient: Analysis["repairRequest"]["recipient"],
  messageKind: Analysis["messageKind"],
) {
  if (recipient === "emergency" || hasDanger(i) || outOfScope(intakeContext(i)))
    return "";
  const ownFixture = recipient === "service";
  const third = i.cause === "third" || i.otherClaim === "third";
  const managerMessage = recipient === "manager";
  const repairHistoryMessage = !i.building
    ? ""
    : {
        yes: "제가 알고 있는 해당 부위의 교체·수리 이력이 있어, 알고 있는 내용을 함께 전달드리겠습니다. 이전 수리 내용이 이번 문제와 관련 있는지도 확인 부탁드립니다.\n",
        no: "제가 알고 있는 해당 부위의 교체·수리 이력은 없습니다. 확인 가능한 이전 점검이나 수리 기록이 있다면 알려주시면 감사하겠습니다.\n",
        unknown:
          "해당 부위의 교체·수리 이력은 아직 확인하지 못했습니다. 이전 점검이나 수리 기록을 확인할 수 있을까요?\n",
      }[i.building.repairHistory];
  const subject = intakeIssueName(i);
  const lightRoute = isLightingIssue(i) ? lightingRoute(i) : undefined;
  const repaired = i.repairStage === "after";
  const opening = repaired
    ? `안녕하세요${managerMessage ? ", 관리 담당자님" : ""}. ${subject} 수리 후 작업 내역을 확인하고 싶어 연락드립니다.`
    : ownFixture
      ? "안녕하세요. 제가 소유한 제품의 점검과 수리 가능 여부를 문의드립니다."
      : managerMessage
        ? `안녕하세요, 관리 담당자님. ${subject} 관련 점검을 문의드립니다.`
        : messageKind === "followup" &&
            ["waiting", "cost", "replied"].includes(i.contact)
          ? `안녕하세요. 앞서 연락드린 ${subject} 관련 점검 일정과 진행 상황을 확인하고 싶습니다.`
          : lightRoute === "bulb"
            ? "안녕하세요. 전구 교체 방법을 확인하고 싶어 연락드립니다."
            : `안녕하세요. ${subject} 때문에 점검이 필요해 연락드립니다.`;
  const followup = messageKind === "followup";
  const hasContact = ["waiting", "cost", "replied"].includes(i.contact);
  const symptom =
    i.observation === "unknown" || i.observation === "light-unknown"
      ? ""
      : `${repaired ? "확인한 증상: " : "현재 "}${observationLabel(i)}.\n`;
  const requestMessage =
    messageKind === "cost"
      ? i.contact === "cost"
        ? "안내받은 비용의 산정 기준과 점검 결과를 알려주실 수 있을까요?"
        : "점검 후 비용을 협의할 수 있도록 원인과 필요한 작업, 항목별 견적을 알려주세요."
      : followup
        ? hasContact
          ? "이전 요청의 진행 상황과 점검 가능한 일정을 회신해 주실 수 있을까요?"
          : "점검 가능 여부와 답변을 받을 수 있는 시점을 안내해 주시면 감사하겠습니다."
        : managerMessage
          ? "해당 시설을 점검해 주실 수 있는지와 가능한 일정을 알려주세요. 직접 처리하기 어려우시면 담당 부서나 점검을 요청할 곳을 안내해 주시면 감사하겠습니다."
          : ownFixture
            ? "점검 일정과 수리 진행 방법을 안내해 주실 수 있을까요?"
            : i.building
              ? "점검을 맡길 관리 담당자나 수리업체, 가능한 방문 일정을 안내해 주실 수 있을까요?"
              : "점검 일정과 수리 진행 방법을 안내해 주실 수 있을까요?";
  const closing = ownFixture
    ? "원인과 수리 범위, 보증 적용 여부 및 예상 견적을 안내 부탁드립니다."
    : managerMessage
      ? "점검 결과와 필요한 수리 범위를 알려주시면 집주인과도 공유하고 비용 부담을 확인하겠습니다."
      : "원인과 수리 범위를 확인한 뒤 비용 부담을 협의하고 싶습니다.";
  const details = i.details;
  const workRequest = repaired
    ? `${i.contact === "cost" ? "안내받은 비용의 산정 기준과 " : ""}실제 작업 범위와 비용 내역을 함께 확인하고 싶습니다. 확인 가능한 영수증이나 점검 내역이 있다면 공유 부탁드립니다.`
    : lightRoute === "bulb" && messageKind === "initial" && !ownFixture
      ? "전구만 교체할 수 있는 형태로 확인했습니다. 사용 가능한 전구 규격과 교체 방법을 알려주실 수 있을까요? 교체 후에도 켜지지 않으면 점검을 부탁드립니다."
      : requestMessage;
  const scopeRequest =
    !repaired && lightRoute === "inspection"
      ? "등기구·스위치·배선 중 어느 부분을 점검해야 하는지 알려주세요. 등기구 전체 교체가 필요하다면 이유와 항목별 견적도 부탁드립니다."
      : !repaired && i.repairStage === "before" && !lightRoute
        ? "수리 전에 필요한 작업 범위와 항목별 견적을 먼저 확인하고 싶습니다."
        : "";
  const contractRequest =
    i.contract.trim() && !ownFixture
      ? "계약서에 적힌 수리 관련 특약이 이번 작업의 어느 항목과 범위에 해당하는지도 함께 확인 부탁드립니다."
      : "";
  const actual = [
    details?.location && `문제가 보이는 곳은 ${details.location}입니다.`,
    details?.discoveredAt &&
      `제가 발견한 시각은 ${details.discoveredAt.replace("T", " ")}입니다.`,
    details?.impact && `사용 중 불편한 점: ${details.impact}`,
    lightRoute &&
      i.preexisting === "yes" &&
      "같은 증상이 입주 당시부터 있었습니다.",
    messageKind !== "initial" &&
      details?.inspection === "yes" &&
      details.technicianNote &&
      `제가 점검 기사에게 들은 내용: ${details.technicianNote}`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    opening,
    symptom.trim(),
    actual,
    i.issue === "drain" ? drainMessage(i).trim() : "",
    repairHistoryMessage.trim(),
    workRequest,
    scopeRequest,
    contractRequest,
    third ? "공용부분이나 다른 세대와 관련이 있는지도 확인 부탁드립니다." : "",
    repaired
      ? "확인된 내역을 바탕으로 비용을 어떻게 처리할지 회신 부탁드립니다."
      : closing,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}
