import {
  photoFollowupSchema,
  photoResultSchema,
  photoUploadSchema,
} from "./photo.js";
import { buildingSchema, buildingGuideSchema } from "./building.js";
import { isLightingIssue, lightingObservations } from "./lighting.js";
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
export const drainSchema = z
  .object({
    location: z.enum(["basin", "sink", "floor", "toilet", "other", "unknown"]),
    locationDetail: z.string().max(80).optional(),
    scope: z.enum(["single", "multiple", "unknown"]),
    overflow: z.enum(["no", "yes", "unknown"]),
    chemical: z.enum(["no", "yes", "unknown"]),
    attempted: z.enum(["none", "cleaned", "tool", "professional", "unknown"]),
  })
  .strict();
export type DrainAnswers = z.infer<typeof drainSchema>;
export const defaultDrain: DrainAnswers = {
  location: "unknown",
  scope: "unknown",
  overflow: "unknown",
  chemical: "unknown",
  attempted: "unknown",
};
export const drainGuideSchema = z.object({
  version: z.string(),
  route: z.enum(["self_check", "contact", "stop"]),
  title: z.string(),
  steps: z.array(z.object({ title: z.string(), body: z.string() })).max(3),
  warning: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })),
});
export const intakeSchema = z
  .object({
    issue: issueSchema,
    details: z
      .object({
        inspection: z.enum(["yes", "no", "unknown"]),
        location: z.string().max(120),
        discoveredAt: z.string().regex(/^(?:|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/),
        impact: z.string().max(240),
        technicianNote: z.string().max(320),
        reply: z.string().max(320),
      })
      .strict()
      .optional(),
    drain: drainSchema.optional(),
    building: buildingSchema.optional(),
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
        ...lightingObservations,
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
        ...lightingObservations,
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
export function intakeIssueName(input: Pick<Intake, "issue" | "observation">) {
  return isLightingIssue(input) ? "전구·조명" : issueNames[input.issue];
}
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
  reviewBasis: z.literal("official_statute").optional(),
  reviewEvidence: z
    .object({
      crossCheckUrl: z.string().url(),
      permissionEvidenceUrl: z.string().url(),
      originalSha256: z.string().regex(/^[a-f0-9]{64}$/),
      reviewerType: z.literal("ai_source_comparison"),
    })
    .optional(),
  use: z.enum(["internal", "public", "general"]),
  scope: z.string(),
  issues: z.array(issueSchema),
});
export type LegalSource = z.infer<typeof sourceSchema>;
export const responseStepSchema = z.object({
  title: z.string().min(1).max(80),
  action: z.string().min(10).max(350),
  reason: z.string().min(10).max(350),
  factKeys: z.array(z.string()).min(1).max(5),
  missingEvidence: z.array(z.string().min(1).max(150)).max(3),
  citations: z
    .array(
      z.object({
        sourceId: z.string(),
        sourceVersion: z.string(),
        claim: z.string(),
        location: z.string(),
      }),
    )
    .min(1)
    .max(3),
});
export const analysisSchema = z.object({
  photoAnalysis: photoResultSchema.optional(),
  drainGuide: drainGuideSchema.optional(),
  buildingGuide: buildingGuideSchema.optional(),
  tailoredResponse: z
    .object({
      summary: z.string().min(10).max(350),
      steps: z.array(responseStepSchema).min(2).max(3),
    })
    .optional(),
  aiExplanation: z.string().min(20).max(700).optional(),
  fallback: z
    .object({ reason: z.string().max(100), notice: z.string().max(400) })
    .optional(),
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
  retrieval: z
    .object({
      datasetVersion: z.string(),
      method: z.literal("postgres-filter-keyword-1"),
      chunks: z
        .array(
          z.object({
            id: z.string(),
            sourceId: z.string(),
            sourceVersion: z.string(),
          }),
        )
        .max(4),
    })
    .optional(),
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
  .object({
    intake: intakeSchema,
    idempotencyKey: z.string().uuid(),
    photos: photoUploadSchema.optional(),
    photoFollowup: photoFollowupSchema.optional(),
  })
  .strict()
  .refine(
    ({ photos, photoFollowup }) =>
      photoFollowup?.action === "retry"
        ? !!photos
        : photoFollowup?.action === "confirm"
          ? !photos
          : true,
    "사진 재분석과 기기 정보 확인의 입력을 확인해 주세요.",
  );
export const consentVersion = "2026-11-11.v7";
export const eventSchema = z.enum([
  "start",
  "questions_complete",
  "analysis_success",
  "copy_success",
  "feedback",
]);
export type EventName = z.infer<typeof eventSchema>;
export type AppConfig = {
  account?: {
    enabled: boolean;
    url: string;
    publishableKey: string;
    google: boolean;
    kakao: boolean;
    signup?: boolean;
    retentionDays: number;
  };
  ai: "mock" | "live";
  storage: "memory" | "database" | "browser";
  publicLaunch: boolean;
  retentionHours: number;
  ready: boolean;
  blockers: string[];
};
