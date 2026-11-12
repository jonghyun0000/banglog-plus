import { passesRepairTeamReview } from "../server/sources/team-review";
import { expect, it } from "vitest";
import {
  moveOutMessage,
  newRepair,
  repairMissing,
  repairSchema,
  repairText,
} from "../shared/repair";
import {
  repairLegalReviews,
  teamReviewed,
  administratorApproved,
  reviewSnapshot,
} from "../shared/repair-review";
import { officialSources } from "../server/sources/official";
import { datasetSources } from "../server/sources/dataset";
import { validateFile } from "../src/features/repair/store";
it("keeps delivery time empty and permits solo records without entry photos", () => {
  const r = newRepair();
  r.location = "욕실 천장";
  r.entryUnavailable = true;
  expect(repairSchema.parse(r).contacts).toEqual([]);
  expect(repairText(r)).toContain("상대방 확인·전달 증명이 아닙니다");
  expect(repairMissing(r)).toContain(
    "입주 사진이 없으면 기존 메시지·점검표 등 대체 자료",
  );
});
it("opens legacy records and separates move-out deductions from actual spending", () => {
  const r = newRepair();
  const { moveOutCosts, ...legacy } = r;
  expect(moveOutCosts).toEqual({});
  expect(repairSchema.parse(legacy).moveOutCosts).toEqual({});
  r.entryUnavailable = true;
  r.existingDamage = "입주 당시 벽지 얼룩";
  r.specialTerms = "청소비는 계약서에 정한 범위";
  r.moveOutCosts = {
    wallpaper: { amount: "120,000", reason: "얼룩" },
    flooring: { amount: "", reason: "긁힘" },
    cleaning: { amount: "0", reason: "" },
  };
  r.paidAmount = "30,000원";
  expect(repairText(r)).toContain("도배 · 공제 요청액: 120,000원");
  expect(repairText(r)).toContain("청소비 · 공제 요청액: 0원");
  expect(repairText(r)).toContain("지출: 30,000원");
  const before = moveOutMessage({ ...r, repairStage: "before" });
  expect(before).toContain("장판 · 공제 요청액 확인 필요");
  expect(before).toContain("입주 당시 벽지 얼룩");
  expect(before).toContain(r.specialTerms);
  expect(before).toContain("항목별 견적을 먼저");
  expect(before).not.toContain(r.paidAmount);
  const after = moveOutMessage({ ...r, repairStage: "after" });
  expect(after).toContain("작업 전후 사진과 영수증");
  expect(after).not.toContain("아직 작업 전");
});
it("awareness exception asks for evidence without inventing delivery", () => {
  const r = newRepair();
  r.landlordAware = "yes";
  expect(repairMissing(r)).toContain("임대인이 이미 알고 있던 정황");
  expect(repairMissing(r)).not.toContain(
    "실제 전달 시각·채널 또는 이미 알고 있던 정황",
  );
  expect(repairText(r)).not.toContain("전달 완료");
});
it("requires two distinct registered team reviewers for the current version", () => {
  const r = structuredClone(repairLegalReviews[0]);
  const team = new Set(["member1", "member2"]);
  const review = {
    reviewerId: "member1",
    reviewedVersion: r.version,
    checkedAt: "2026-11-11",
    approved: true,
  };
  r.status = "approved";
  r.reviews = [review, review];
  expect(teamReviewed(r, team)).toBe(false);
  r.reviews = [review, { ...review, reviewerId: "outsider" }];
  expect(teamReviewed(r, team)).toBe(false);
  r.reviews = [
    review,
    { ...review, reviewerId: "member2", reviewedVersion: "old" },
  ];
  expect(teamReviewed(r, team)).toBe(false);
  r.reviews = [review, { ...review, reviewerId: "member2" }];
  expect(teamReviewed(r, team)).toBe(true);
  r.status = "pending";
  expect(teamReviewed(r, team)).toBe(false);
});
it("all seven admin approvals remain separate from team reviews and operational AI datasets", () => {
  expect(repairLegalReviews).toHaveLength(7);
  for (const r of repairLegalReviews) {
    expect(r.status).toBe("approved");
    expect(administratorApproved(r)).toBe(true);
    expect(teamReviewed(r, new Set())).toBe(false);
    expect(r.reviews).toEqual([]);
    expect(
      [...officialSources, ...datasetSources].some((s) => s.id === r.id),
    ).toBe(false);
  }
  expect(
    repairLegalReviews.find((r) => r.id === "repair-civil-634")?.draft,
  ).toContain("예외");
});
it("rejects executable or oversized attachments", () => {
  expect(() =>
    validateFile(new File(["x"], "x.html", { type: "text/html" })),
  ).toThrow();
  expect(() =>
    validateFile(
      new File([new Uint8Array(21 * 1024 * 1024)], "x.jpg", {
        type: "image/jpeg",
      }),
    ),
  ).toThrow();
  expect(() =>
    validateFile(
      new File(["%PDF"], "receipt.pdf", { type: "application/pdf" }),
    ),
  ).not.toThrow();
});

it("server accepts registered admin approvals but rejects unknown repair drafts", () => {
  expect(passesRepairTeamReview("civil-623")).toBe(true);
  for (const r of repairLegalReviews)
    expect(passesRepairTeamReview(r.id)).toBe(true);
  expect(passesRepairTeamReview("repair-forged")).toBe(false);
});

it("invalidates admin approval for changed content, scope, version or revoked status", () => {
  for (const field of [
    "draft",
    "scope",
    "version",
    "url",
    "title",
    "checkedAt",
    "effectiveDate",
  ] as const) {
    const r = structuredClone(repairLegalReviews[0]);
    r[field] = "changed";
    expect(administratorApproved(r)).toBe(false);
  }
  const r = structuredClone(repairLegalReviews[0]);
  r.status = "pending";
  expect(administratorApproved(r)).toBe(false);
  r.status = "approved";
  r.id = "repair-forged";
  expect(administratorApproved(r)).toBe(false);
  expect(reviewSnapshot(r)).not.toBe(reviewSnapshot(repairLegalReviews[0]));
});
