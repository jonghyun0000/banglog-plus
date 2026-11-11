import adminApprovals from "./repair-admin-approvals.json" with { type: "json" };
export interface LegalReview {
  id: string;
  title: string;
  url: string;
  effectiveDate: string | null;
  checkedAt: string;
  scope: string;
  draft: string;
  status: "pending" | "approved";
  reviews: {
    reviewerId: string;
    reviewedVersion: string;
    checkedAt: string;
    approved: boolean;
  }[];
  version: string;
}
const statute = (
  article: number,
  title: string,
  draft: string,
  scope: string,
): LegalReview => ({
  id: `repair-civil-${article}`,
  title: `민법 제${article}조${article === 626 ? " 제1항" : ""} · ${title}`,
  url: `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0${article}&lsiSeq=284415&urlMode=lsScJoRltInfoR`,
  effectiveDate: "2026-03-17",
  checkedAt: "2026-11-11",
  scope,
  draft,
  status: "approved",
  reviews: [],
  version: "2026-11-11.v1",
});
export const repairLegalReviews: LegalReview[] = [
  statute(
    623,
    "수선 요청",
    "사용에 지장이 있는 상태와 수선 요청을 기록한다.",
    "수선 요청의 일반 근거. 모든 고장 비용을 임대인 부담으로 확정하지 않음.",
  ),
  statute(
    634,
    "통지와 이미 알고 있던 경우",
    "통지 시점·방법을 기록하고 임대인이 이미 알고 있던 경우의 예외를 구분한다.",
    "앱 저장은 실제 통지가 아님. 임대인이 이미 알았다는 정황도 사용자 진술과 증거를 구분.",
  ),
  statute(
    654,
    "임대차 준용",
    "제615조 등을 임대차에 준용하는 관계를 확인한다.",
    "615조와 함께 검토. 전액 교체비·과실 비율 산정 불가.",
  ),
  statute(
    615,
    "원상회복",
    "입주와 반환 당시 같은 위치의 상태를 비교한다.",
    "기존 하자·통상 마모·특약을 확인하며 사진 부재를 책임 인정으로 취급하지 않음.",
  ),
  statute(
    626,
    "필요비 상환",
    "보존에 필요한 지출의 영수증·견적·업체 소견을 모은다.",
    "제1항에 한정. 모든 지출의 상환을 보장하지 않고 유익비와 구분.",
  ),
  ...[
    {
      id: 32,
      title: "욕실·세탁실 누수 조정사례",
      draft: "최초 발견·재발·통지·업체 점검 기록을 확인한다.",
    },
    {
      id: 30,
      title: "보증금 반환·원상회복 조정사례",
      draft: "입주 상태·통상적인 마모 여부·특약·공제 사유를 확인한다.",
    },
  ].map((s) => ({
    id: `repair-adr-${s.id}`,
    title: s.title,
    url: `https://adrhome.reb.or.kr/adrhome/reb/LO010100/bbs/View.do?Key=10404000000002022101718&boardIdx=${s.id}&boardNo=11`,
    effectiveDate: null,
    checkedAt: "2026-11-11",
    scope:
      "2022-07-14 게시 조정사례. 법원 판결·일반화된 책임 기준이 아니며 기록 체크리스트로만 활용.",
    draft: s.draft,
    status: "approved" as const,
    reviews: [],
    version: "2026-11-11.v1",
  })),
];
// A two-person team review is an additional gate, not a replacement for legal/permission approval.
export function teamReviewed(r: LegalReview, teamIds: ReadonlySet<string>) {
  return (
    r.status === "approved" &&
    new Set(
      r.reviews
        .filter(
          (v) =>
            v.approved &&
            v.reviewedVersion === r.version &&
            teamIds.has(v.reviewerId) &&
            /^\d{4}-\d{2}-\d{2}$/.test(v.checkedAt),
        )
        .map((v) => v.reviewerId),
    ).size >= 2
  );
}

// Admin authorization is separate from team and professional legal review.
export function reviewSnapshot(r: LegalReview) {
  return JSON.stringify([
    r.id,
    r.version,
    r.title,
    r.url,
    r.effectiveDate,
    r.checkedAt,
    r.scope,
    r.draft,
  ]);
}
export function administratorApproved(r: LegalReview): boolean {
  const approval = adminApprovals.find((a) => a.sourceId === r.id);
  return (
    !!approval &&
    r.status === "approved" &&
    approval.approvalType === "administrator_single" &&
    approval.administratorId === "project-owner-jonghyun" &&
    approval.snapshot === reviewSnapshot(r)
  );
}
export function repairReviewApproved(
  r: LegalReview,
  teamIds: ReadonlySet<string>,
) {
  return administratorApproved(r) || teamReviewed(r, teamIds);
}
export function repairReviewLabel(r: LegalReview) {
  return administratorApproved(r)
    ? "관리자 단독 승인 · 팀 교차·전문가 검토 미완료"
    : "검토 대기";
}
