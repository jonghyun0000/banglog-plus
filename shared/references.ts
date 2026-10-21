import type { Issue } from "./schema.js";

// Educational source notes are separate from an analysis's validated citations.
// Original-text checks do not mean professional legal review or case matching.
export const referenceCases: {
  id: string;
  title: string;
  date: string;
  url: string;
  summary: string;
  limit: string;
  takeaway: string;
  issues: Issue[];
}[] = [
  {
    id: "2023da249661",
    title: "대법원 2023다249661 · 원상회복 범위",
    date: "2023. 11. 2.",
    url: "https://www.law.go.kr/LSW/precInfoP.do?precSeq=237925",
    summary:
      "토지를 빌릴 때 이미 있던 이전 임차인의 시설까지 철거할 의무는 원칙적으로 없으며, 계약 내용 등 특별한 사정을 개별적으로 살펴야 한다고 판단했어요.",
    limit:
      "토지·시설물 사건으로, 주택 벽지·장판의 마모나 교체비를 직접 판단한 사건은 아니에요.",
    takeaway: "입주 당시 상태와 계약의 원상회복 문구를 함께 확인해요.",
    issues: ["surface", "mold", "leak", "drain"],
  },
  {
    id: "2018da291347",
    title: "대법원 2018다291347 · 임대 장비의 훼손",
    date: "2019. 4. 11.",
    url: "https://www.law.go.kr/LSW/precInfoP.do?precSeq=207102",
    summary:
      "임대 장비 반환 시 훼손에 대한 손해배상 사건이에요. 임차인이 책임질 수 없는 사유의 증명과, 임대인의 지배·관리 영역에 있는 하자 여부를 심리해야 한다고 판단했어요.",
    limit:
      "주택 옵션 가전 사건은 아니에요. 수선의무와 훼손에 대한 배상책임을 구분해야 하며, 고장 원인이 불명확하다는 이유만으로 임차인이 면책되는 것도 아니에요.",
    takeaway:
      "옵션 목록·제품 연식·점검 소견을 보관하고, 수리 요청과 최종 비용 판단을 구분해요.",
    issues: ["fixture", "boiler", "drain", "leak"],
  },
];
