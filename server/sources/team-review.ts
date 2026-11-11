import {
  repairLegalReviews,
  repairReviewApproved,
} from "../../shared/repair-review.js";
// Populate only from confirmed team reviewer identities during reviewed changes.
// Browser input and self-declared reviews never grant this approval.
const trustedReviewerIds: ReadonlySet<string> = new Set();
export function passesRepairTeamReview(sourceId: string): boolean {
  if (!sourceId.startsWith("repair-")) return true;
  const draft = repairLegalReviews.find((r) => r.id === sourceId);
  return !!draft && repairReviewApproved(draft, trustedReviewerIds);
}
