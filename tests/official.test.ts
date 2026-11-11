import { expect, it } from "vitest";
import {
  officialChunks,
  officialSources,
  officialDatasetVersion,
  isVerifiedOfficialRow,
} from "../server/sources/official.js";
const c = officialChunks[0];
const row = {
  id: c.id,
  dataset_version: officialDatasetVersion,
  source_id: c.sourceId,
  source_version: c.sourceVersion,
  claim_id: c.claimId,
  claim: c.claim,
  content: c.text,
  issues: c.issues,
  source: officialSources[0],
  technical_status: "verified",
  human_legal_review: "pending",
  use_scope: "general",
};
it("official text tier does not pretend to be human legal approval", () => {
  expect(isVerifiedOfficialRow(row)).toBe(true);
  expect(officialSources.every((s) => s.humanLegalReview === "pending")).toBe(
    true,
  );
});
it.each([
  "content",
  "claim",
  "source_version",
  "dataset_version",
  "source_id",
  "claim_id",
  "technical_status",
  "human_legal_review",
  "use_scope",
])("rejects changed %s before GPT", (key) => {
  expect(isVerifiedOfficialRow({ ...row, [key]: "tampered" })).toBe(false);
});
it("rejects modified metadata, scope and issue applicability", () => {
  expect(
    isVerifiedOfficialRow({
      ...row,
      source: { ...row.source, scope: "무조건 임대인 전액 책임" },
    }),
  ).toBe(false);
  expect(isVerifiedOfficialRow({ ...row, issues: ["mold"] })).toBe(false);
});

it("limits new restoration statutes to their approved scopes", () => {
  expect(officialSources).toHaveLength(5);
  for (const id of ["civil-615", "civil-654"]) {
    const source = officialSources.find((s) => s.id === id)!;
    expect(source.issues).toEqual(["surface", "fixture"]);
    expect(source.humanLegalReview).toBe("pending");
    expect(source.scope).toContain("615");
    expect(source.scope).toContain("654");
  }
  expect(officialSources.some((s) => s.id.includes("adr"))).toBe(false);
});
