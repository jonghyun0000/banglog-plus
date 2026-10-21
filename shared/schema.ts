import { z } from "zod";
export const issueSchema = z.enum([
  "mold",
  "leak",
  "boiler",
  "surface",
  "drain",
  "fixture",
]);
export type Issue = z.infer<typeof issueSchema>;
export const issueNames: Record<Issue, string> = {
  mold: "곰팡이·결로",
  leak: "누수",
  boiler: "보일러 고장",
  surface: "벽지·장판 손상",
  drain: "배수 문제",
  fixture: "옵션 제품 고장",
};
export const intakeSchema = z
  .object({
    issue: issueSchema,
    inputVersion: z.number().int().min(1).max(1000),
    description: z.string().max(1000),
    observation: z
      .enum([
        "unknown",
        "wall",
        "condensation",
        "furniture",
        "ceiling",
        "pipe",
        "rain",
        "hotwater",
        "heating",
        "power",
        "wall-tear",
        "wall-dent",
        "floor-tear",
        "floor-dent",
        "poor-drain",
        "slow-drain",
        "backflow",
        "blocked-drain",
        "aircon",
        "option-boiler",
        "washer",
        "fridge",
        "stove",
        "cabinet",
        "bed",
        "other-fixture",
      ])
      .default("unknown"),
    safety: z.enum(["none", "gas", "fire", "electric", "unknown"]),
    discovered: z.enum(["today", "week", "long", "unknown"]),
    preexisting: z.enum(["yes", "no", "unknown", "na"]),
    installed: z.enum(["original", "own", "unknown", "na"]),
    cause: z.enum(["unknown", "aging", "damage", "mixed", "third", "wear"]),
    causeSource: z.enum(["self", "landlord", "technician", "unknown"]),
    otherClaim: z.enum([
      "none",
      "wear",
      "aging",
      "damage",
      "mixed",
      "third",
      "unknown",
    ]),
    contract: z.string().max(300),
    contact: z.enum(["no", "waiting", "cost", "replied", "unknown"]),
  })
  .strict()
  .superRefine((i, ctx) => {
    const allowed = {
      mold: ["unknown", "wall", "condensation", "furniture"],
      leak: ["unknown", "ceiling", "pipe", "rain"],
      boiler: ["unknown", "hotwater", "heating", "power"],
      surface: [
        "unknown",
        "wall-tear",
        "wall-dent",
        "floor-tear",
        "floor-dent",
      ],
      drain: [
        "unknown",
        "poor-drain",
        "slow-drain",
        "backflow",
        "blocked-drain",
      ],
      fixture: [
        "unknown",
        "aircon",
        "option-boiler",
        "washer",
        "fridge",
        "stove",
        "cabinet",
        "bed",
        "other-fixture",
      ],
    };
    if (!allowed[i.issue].includes(i.observation))
      ctx.addIssue({
        code: "custom",
        path: ["observation"],
        message: "문제 유형에 맞는 증상을 선택하세요.",
      });
  });
export type Intake = z.infer<typeof intakeSchema>;
export const defaultIntake: Intake = {
  issue: "mold",
  inputVersion: 1,
  description: "",
  observation: "unknown",
  safety: "unknown",
  discovered: "unknown",
  preexisting: "unknown",
  installed: "unknown",
  cause: "unknown",
  causeSource: "unknown",
  otherClaim: "none",
  contract: "",
  contact: "no",
};
export const directionSchema = z.enum([
  "landlord",
  "tenant",
  "mixed",
  "undetermined",
]);
export type Direction = z.infer<typeof directionSchema>;
export const directionNames: Record<Direction, string> = {
  landlord: "집주인 부담 검토",
  tenant: "세입자 부담 검토",
  mixed: "복합 원인 확인",
  undetermined: "추가 확인 필요",
};
export const factSchema = z.object({
  key: z.string(),
  value: z.string(),
  provenance: z.enum([
    "tenant_report",
    "landlord_claim",
    "relayed_technician",
    "unknown",
  ]),
});
export const sourceSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  institution: z.string(),
  url: z.string().url(),
  location: z.string(),
  checkedAt: z.string(),
  effectiveDate: z.string().nullable(),
  technicalStatus: z.enum(["verified", "pending"]),
  humanLegalReview: z.enum(["pending", "approved"]),
  use: z.enum(["internal", "public"]),
  scope: z.string(),
  issues: z.array(issueSchema),
});
export type LegalSource = z.infer<typeof sourceSchema>;
export const analysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  analysisId: z.string().uuid(),
  inputVersion: z.number().int(),
  audience: z.literal("tenant"),
  mode: z.enum(["mock", "live"]),
  status: z.enum([
    "complete",
    "needs_information",
    "out_of_scope",
    "safety_priority",
    "failed",
  ]),
  userReportedFacts: z.array(factSchema),
  unknownFacts: z.array(z.string()),
  conflictingFacts: z.array(z.string()),
  repairRequest: z.object({
    recipient: z.enum(["landlord", "manager", "service", "emergency"]),
    reason: z.string(),
    immediateAction: z.string(),
  }),
  costResponsibility: z.object({
    direction: directionSchema,
    conditions: z.array(z.string()),
    uncertainty: z.string(),
  }),
  citedClaims: z.array(
    z.object({
      claim: z.string(),
      sourceId: z.string(),
      sourceVersion: z.string(),
      location: z.string(),
    }),
  ),
  sources: z.array(sourceSchema),
  additionalChecks: z.array(z.string()),
  otherPartyCheckRequired: z.boolean(),
  nextActions: z.array(z.string()).max(3),
  messageDraft: z.string(),
  messageKind: z.enum(["initial", "cost", "followup"]),
  cautions: z.array(z.string()),
  questionVersion: z.string(),
  ruleVersion: z.string(),
  promptVersion: z.string(),
  model: z.string(),
  generatedAt: z.string(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const feedbackSchema = z
  .object({
    helpful: z.enum(["yes", "no", "unsure"]),
    understood: z.enum(["yes", "no", "unsure"]),
    errorType: z.enum([
      "none",
      "fact",
      "source",
      "responsibility",
      "wording",
      "other",
    ]),
  })
  .strict();
export type Feedback = z.infer<typeof feedbackSchema>;
export const analyzeRequestSchema = z
  .object({ intake: intakeSchema, idempotencyKey: z.string().uuid() })
  .strict();
export const consentVersion = "2026-10-15.v1";
export const eventSchema = z.enum([
  "start",
  "questions_complete",
  "analysis_success",
  "copy_success",
  "feedback",
]);
export type EventName = z.infer<typeof eventSchema>;
export type AppConfig = {
  ai: "mock" | "live";
  storage: "memory" | "database" | "browser";
  publicLaunch: false;
  retentionHours: number;
  ready: boolean;
  blockers: string[];
};
