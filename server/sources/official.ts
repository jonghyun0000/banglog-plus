import { passesRepairTeamReview } from "./team-review.js";
import { isDeepStrictEqual } from "node:util";
import manifest from "../../data/official-statutes.v2.json" with { type: "json" };
import { sourceSchema } from "../../shared/schema.js";

export const officialDatasetVersion = manifest.version;
export const officialSources = manifest.sources.map((s) =>
  sourceSchema.parse(s),
);
export const officialChunks = manifest.chunks;
// This is a bounded, source-compared statutory text tier, NOT expert case approval.
// DB permission must ALSO be current and unrevoked (checked in retrieval SQL).
export function isVerifiedOfficialRow(row: Record<string, unknown>): boolean {
  const chunk = officialChunks.find((c) => c.id === row.id);
  const source = manifest.sources.find((s) => s.id === chunk?.sourceId);
  return (
    !!chunk &&
    passesRepairTeamReview(`repair-${chunk.sourceId}`) &&
    !!source &&
    row.dataset_version === officialDatasetVersion &&
    row.source_id === chunk.sourceId &&
    row.source_version === chunk.sourceVersion &&
    row.claim_id === chunk.claimId &&
    row.claim === chunk.claim &&
    row.content === chunk.text &&
    isDeepStrictEqual(row.source, source) &&
    isDeepStrictEqual(row.issues, chunk.issues) &&
    row.technical_status === "verified" &&
    row.human_legal_review === "pending" &&
    row.use_scope === "general"
  );
}
