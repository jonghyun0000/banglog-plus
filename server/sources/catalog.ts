import type { Issue, LegalSource } from "../../shared/schema.js";
export const sources: LegalSource[] = [
  {
    id: "civil-623",
    version: "2026-03-17.checked-2026-10-21",
    title: "민법 제623조 · 임대인의 의무",
    institution: "국가법령정보센터 / 법무부",
    url: "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR",
    location: "제623조",
    checkedAt: "2026-10-21",
    effectiveDate: "2026-03-17",
    technicalStatus: "verified",
    humanLegalReview: "pending",
    use: "internal",
    scope:
      "주택 사용·수익에 필요한 상태 유지 의무의 일반 원칙. 개별 원인·특약·비용 귀속을 확정하지 않음.",
    issues: ["mold", "leak", "boiler", "surface", "drain", "fixture"],
  },
  {
    id: "easylaw-repair",
    version: "checked-2026-10-21",
    title: "주택임대차 · 임대인의 권리·의무",
    institution: "찾기쉬운 생활법령정보",
    url: "https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov",
    location: "임대인의 의무 / 수선의무",
    checkedAt: "2026-10-21",
    effectiveDate: null,
    technicalStatus: "verified",
    humanLegalReview: "pending",
    use: "internal",
    scope:
      "수선의무 범위·사용수익 방해·특약 확인을 위한 일반 설명. 사건별 사람 검토 필요.",
    issues: ["mold", "leak", "boiler", "surface", "drain", "fixture"],
  },
];
export const claimCatalog = [
  {
    id: "maintenance",
    sourceId: "civil-623",
    claim:
      "임대인은 계약 기간 동안 주택을 사용·수익하는 데 필요한 상태를 유지할 의무가 있다는 일반 원칙이 있어요.",
  },
  {
    id: "scope",
    sourceId: "easylaw-repair",
    claim:
      "수선의무 범위는 사용에 미치는 영향과 수리의 정도, 계약 조건 등을 함께 확인해야 해요.",
  },
];
export function searchSources(issue: Issue, publicUse = false) {
  return sources.filter(
    (s) =>
      s.issues.includes(issue) &&
      s.technicalStatus === "verified" &&
      (!publicUse || (s.humanLegalReview === "approved" && s.use === "public")),
  );
}
export function validateClaims(ids: string[], retrieved: LegalSource[]) {
  return ids.map((id) => {
    const claim = claimCatalog.find((c) => c.id === id);
    const source = retrieved.find(
      (s) => s.id === claim?.sourceId && s.technicalStatus === "verified",
    );
    if (!claim || !source) throw new Error("INVALID_SOURCE");
    return {
      claim: claim.claim,
      sourceId: source.id,
      sourceVersion: source.version,
      location: source.location,
    };
  });
}
export function verifyCitations(
  citations: {
    claim: string;
    sourceId: string;
    sourceVersion: string;
    location: string;
  }[],
  retrieved: LegalSource[],
) {
  return citations.every(
    (c) =>
      retrieved.some(
        (s) =>
          s.id === c.sourceId &&
          s.version === c.sourceVersion &&
          s.location === c.location &&
          s.technicalStatus === "verified",
      ) &&
      claimCatalog.some(
        (a) => a.sourceId === c.sourceId && a.claim === c.claim,
      ),
  );
}
