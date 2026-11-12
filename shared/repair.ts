import { z } from "zod";
import { repairGuideSchema } from "./repair-guide.js";
import { intakeIssueName, repairStageSchema } from "./schema.js";
import {
  intakeDetails,
  observationLabel,
  answerLabel,
  repairStageLabels,
} from "./questions.js";
import { drainFacts } from "./drain.js";
const text = z.string().max(5000);
const localTime = z
  .string()
  .refine(
    (v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v),
    "날짜와 시각을 확인해 주세요.",
  );
export const attachmentKinds = {
  discovery: "발견 사진·영상",
  entry: "입주 사진",
  exit: "퇴실 사진",
  quote: "견적",
  receipt: "영수증",
  opinion: "업체 소견",
} as const;
export const moveOutCostLabels = {
  wallpaper: "도배",
  flooring: "장판",
  cleaning: "청소비",
} as const;
export type MoveOutCostKind = keyof typeof moveOutCostLabels;
const moveOutCostSchema = z.object({
  amount: z.string().max(40),
  reason: z.string().max(300),
});
export const repairSchema = z.object({
  id: z.string().uuid(),
  location: z.string().max(200),
  guides: z.array(repairGuideSchema).max(100).default([]),
  inspectionQuestions: z
    .array(z.enum(["cause", "unknown", "scope", "cost", "documents"]))
    .max(5)
    .default([]),
  inspectionAnswers: text.default(""),
  itemizedCost: text.default(""),
  discoveredAt: localTime,
  impact: text,
  recurrence: text,
  inspection: text,
  landlordAware: z.enum(["unknown", "yes", "no"]),
  awarenessEvidence: text,
  contacts: z
    .array(
      z.object({
        id: z.string().uuid(),
        sentAt: localTime,
        channel: z.string().max(100),
        content: text,
        replyAt: localTime,
        reply: text,
        recordedAt: z.string().datetime(),
      }),
    )
    .max(100),
  entryUnavailable: z.boolean(),
  existingDamage: text,
  exitCondition: text,
  deductionReason: text,
  moveOutCosts: z
    .object({
      wallpaper: moveOutCostSchema.optional(),
      flooring: moveOutCostSchema.optional(),
      cleaning: moveOutCostSchema.optional(),
    })
    .default({}),
  repairStage: repairStageSchema.optional(),
  specialTerms: text,
  quote: text,
  paidAmount: text,
  contractorOpinion: text,
  attachments: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum([
          "discovery",
          "entry",
          "exit",
          "quote",
          "receipt",
          "opinion",
        ]),
        name: z.string().max(255),
        type: z.string().max(100),
        size: z.number().nonnegative(),
        capturedAt: localTime,
        recordedAt: z.string().datetime(),
      }),
    )
    .max(30),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RepairRecord = z.infer<typeof repairSchema>;
export type AttachmentKind = keyof typeof attachmentKinds;
export function newRepair(): RepairRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    location: "",
    guides: [],
    inspectionQuestions: [],
    inspectionAnswers: "",
    itemizedCost: "",
    discoveredAt: "",
    impact: "",
    recurrence: "",
    inspection: "",
    landlordAware: "unknown",
    awarenessEvidence: "",
    contacts: [],
    entryUnavailable: false,
    existingDamage: "",
    exitCondition: "",
    deductionReason: "",
    moveOutCosts: {},
    specialTerms: "",
    quote: "",
    paidAmount: "",
    contractorOpinion: "",
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function moveOutCostEntries(r: RepairRecord) {
  return (Object.keys(moveOutCostLabels) as MoveOutCostKind[]).flatMap(
    (kind) => {
      const cost = r.moveOutCosts[kind];
      const amount = cost?.amount.trim() ?? "";
      const reason = cost?.reason.trim() ?? "";
      if (!amount && !reason) return [];
      const digits = amount.replaceAll(",", "");
      const displayAmount =
        /^\d{1,12}$/.test(digits) && /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(amount)
          ? `${Number(digits).toLocaleString("ko-KR")}원`
          : amount;
      return [
        {
          kind,
          label: moveOutCostLabels[kind],
          amount: displayAmount,
          reason,
        },
      ];
    },
  );
}
export function moveOutMessage(r: RepairRecord) {
  const excerpt = (value: string, max = 100) => {
    const clean = value.trim().replace(/\s+/g, " ");
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  };
  const location = excerpt(r.location);
  const entry = excerpt(r.existingDamage);
  const exit = excerpt(r.exitCondition);
  const reason = excerpt(r.deductionReason);
  const terms = excerpt(r.specialTerms, 160);
  const costs = moveOutCostEntries(r);
  return [
    "안녕하세요. 퇴실 비용과 보증금 공제 내역을 확인하고 싶어 연락드립니다.",
    location && `비교 위치: ${location}`,
    entry && `제가 기록한 입주 당시 상태: ${entry}`,
    exit && `제가 기록한 퇴실 상태: ${exit}`,
    reason && `제가 전달받은 공제 사유: ${reason}`,
    ...costs.map(
      ({ label, amount, reason }) =>
        `- ${label}${amount ? ` · 공제 요청액 ${amount}` : " · 공제 요청액 확인 필요"}${reason ? ` · 전달받은 사유: ${excerpt(reason)}` : ""}`,
    ),
    terms && !/^(없음|없어요|모름|모르겠어요|미확인)[.!]?$/u.test(terms)
      ? `제가 확인한 특약은 “${terms}”입니다. 어떤 항목에 어떤 범위로 적용하신 건지 알려주세요.`
      : "공제에 적용하신 계약 조항이나 특약이 있다면 해당 문구를 알려주세요.",
    r.repairStage === "before"
      ? "아직 작업 전이라 필요한 작업 범위와 항목별 견적을 먼저 공유해 주세요. 입주 상태와 퇴실 상태를 함께 확인한 뒤 비용을 협의하고 싶습니다."
      : r.repairStage === "after"
        ? "작업이 끝난 항목은 실제 작업 범위와 항목별 비용을 확인하고 싶습니다. 작업 전후 사진과 영수증 또는 작업 내역서가 있다면 공유해 주세요."
        : "항목별 공제 사유와 작업 진행 여부를 알려주세요. 진행 전이면 견적을, 완료한 작업이면 작업 내역과 영수증을 부탁드립니다.",
    "자료를 확인한 뒤 공제 내역을 함께 협의하고 싶습니다.",
  ]
    .filter(Boolean)
    .join("\n");
}
export function repairMissing(r: RepairRecord) {
  return [
    !r.location && "문제 위치",
    !r.discoveredAt && "최초 발견 시각",
    !r.impact && "사용에 지장이 생긴 부분",
    !r.contacts.some((c) => c.sentAt && c.channel) &&
      r.landlordAware !== "yes" &&
      "실제 전달 시각·채널 또는 이미 알고 있던 정황",
    r.landlordAware === "yes" &&
      !r.awarenessEvidence &&
      "임대인이 이미 알고 있던 정황",
    !r.attachments.some((a) => a.kind === "entry") &&
      "입주 사진이 없으면 기존 메시지·점검표 등 대체 자료",
    !r.inspection && "업체 점검 내용",
    !r.specialTerms && "계약 특약 확인",
  ].filter(Boolean) as string[];
}
export function repairText(r: RepairRecord) {
  return [
    `수선 기록 · ${r.location || "위치 미입력"}`,
    `사용자 입력 사실이며 상대방 확인·전달 증명이 아닙니다.`,
    `발견: ${r.discoveredAt || "미입력"}`,
    `사용 지장: ${r.impact || "미입력"}`,
    `재발: ${r.recurrence || "미입력"}`,
    `점검: ${r.inspection || "미입력"}`,
    `앱 저장: ${r.updatedAt}`,
    ...r.contacts.map(
      (c) =>
        `실제 전달(직접 입력): ${c.sentAt || "미입력"} / ${c.channel || "미입력"}\n내용: ${c.content}\n답변 시각: ${c.replyAt || "미입력"}\n답변: ${c.reply || "아직 기록 없음"}\n기록 생성: ${c.recordedAt}`,
    ),
    `기존 하자: ${r.existingDamage || "미입력"}`,
    `퇴실 상태: ${r.exitCondition || "미입력"}`,
    `공제 사유(임대인 주장): ${r.deductionReason || "미입력"}`,
    ...moveOutCostEntries(r).map(
      ({ label, amount, reason }) =>
        `${label} · 공제 요청액: ${amount || "미입력"} · 전달받은 사유: ${reason || "미입력"}`,
    ),
    ...(r.repairStage
      ? [`작업 진행 상태: ${repairStageLabels[r.repairStage]}`]
      : []),
    `특약: ${r.specialTerms || "미입력"}`,
    `견적: ${r.quote || "미입력"}`,
    `지출: ${r.paidAmount || "미입력"}`,
    `업체 소견: ${r.contractorOpinion || "미입력"}`,
    ...(r.inspectionAnswers
      ? [`기사에게 들은 점검 답변: ${r.inspectionAnswers}`]
      : []),
    ...(r.itemizedCost ? [`항목별 비용 메모: ${r.itemizedCost}`] : []),
    ...r.guides.map((g) =>
      [
        `연결한 안내 · ${intakeIssueName(g.intake)} · ${g.result.analysisId}`,
        `사용자 진술: ${observationLabel(g.intake)} · ${answerLabel("discovered", g.intake.discovered)} · ${answerLabel("contact", g.intake.contact)}`,
        ...intakeDetails(g.intake).map(
          ([label, value]) => `${label}: ${value}`,
        ),
        ...drainFacts(g.intake).map((f) => f.value),
        g.intake.description,
        `연락 문구 초안: ${g.draft}`,
        `근거 자료 버전: ${g.result.retrieval?.datasetVersion ?? "미제공"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `추가 자료: ${repairMissing(r).join(", ")}`,
    `첨부 ${r.attachments.length}개: 텍스트 복사에는 파일이 포함되지 않습니다.`,
  ].join("\n\n");
}
