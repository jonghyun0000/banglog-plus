import { z } from "zod";
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
export const repairSchema = z.object({
  id: z.string().uuid(),
  location: z.string().max(200),
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
    specialTerms: "",
    quote: "",
    paidAmount: "",
    contractorOpinion: "",
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
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
    `특약: ${r.specialTerms || "미입력"}`,
    `견적: ${r.quote || "미입력"}`,
    `지출: ${r.paidAmount || "미입력"}`,
    `업체 소견: ${r.contractorOpinion || "미입력"}`,
    `추가 자료: ${repairMissing(r).join(", ")}`,
    `첨부 ${r.attachments.length}개: 텍스트 복사에는 파일이 포함되지 않습니다.`,
  ].join("\n\n");
}
