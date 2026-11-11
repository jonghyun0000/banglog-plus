import { z } from "zod";
import {
  analysisSchema,
  intakeSchema,
  type Analysis,
  type Intake,
} from "./schema.js";
import { sanitizeIntake } from "./safety.js";
import { emptyDetails, hasReply } from "./questions.js";
import type { RepairRecord } from "./repair.js";

export const repairGuideSchema = z.object({
  intake: intakeSchema,
  result: analysisSchema,
  draft: z.string().max(2000),
});
export type RepairGuide = z.infer<typeof repairGuideSchema>;

export function guideFields(guide: RepairGuide) {
  const { intake } = guide;
  return {
    location:
      intake.details?.location ||
      (intake.drain?.location === "other"
        ? intake.drain.locationDetail
        : guide.result.userReportedFacts.find(
            (f) =>
              f.key === "drain.location" &&
              intake.drain?.location !== "unknown",
          )?.value) ||
      "",
    discoveredAt: intake.details?.discoveredAt || "",
    impact: intake.details?.impact || "",
    contractorOpinion: intake.details?.technicianNote || "",
    specialTerms: intake.contract,
  };
}

export function mergeRepairGuide(
  record: RepairRecord,
  guide: RepairGuide,
  questions: RepairRecord["inspectionQuestions"],
): RepairRecord {
  const fields = guideFields(guide);
  const alreadySaved = record.guides.some(
    (g) => g.result.analysisId === guide.result.analysisId,
  );
  if (!alreadySaved && record.guides.length >= 100)
    throw Error("이 기록에는 안내를 최대 100개까지 연결할 수 있어요.");
  return {
    ...record,
    location: record.location || fields.location,
    discoveredAt: record.discoveredAt || fields.discoveredAt,
    impact: record.impact || fields.impact,
    contractorOpinion: record.contractorOpinion || fields.contractorOpinion,
    specialTerms: record.specialTerms || fields.specialTerms,
    inspectionQuestions: [
      ...new Set([...record.inspectionQuestions, ...questions]),
    ],
    guides: alreadySaved
      ? record.guides.map((g) =>
          g.result.analysisId === guide.result.analysisId ? guide : g,
        )
      : [...record.guides, guide],
  };
}

export function prepareRepairFollowup(
  record: RepairRecord,
  technician: string,
  reply: string,
): Intake | null {
  const latest = record.guides.at(-1)?.intake;
  if (!latest) return null;
  const next = { ...latest, details: { ...(latest.details ?? emptyDetails) } };
  if (technician.trim()) {
    // A new narrative report does not imply a structured cause or a verified diagnosis.
    next.details.inspection = "yes";
    next.details.technicianNote = technician;
    next.cause = "unknown";
    next.causeSource = "unknown";
  }
  if (reply.trim()) {
    next.contact = hasReply(latest) ? latest.contact : "replied";
    next.details.reply = reply;
    next.otherClaim = "unknown";
    if (next.causeSource === "landlord") {
      next.cause = "unknown";
      next.causeSource = "unknown";
    }
  }
  return sanitizeIntake(next);
}

export type RepairImport = {
  guide: RepairGuide;
  images: string[];
  inspectionQuestions: RepairRecord["inspectionQuestions"];
  targetId?: string;
};

export function canLinkGuide(result: Analysis) {
  return (
    result.status !== "safety_priority" && result.status !== "out_of_scope"
  );
}
