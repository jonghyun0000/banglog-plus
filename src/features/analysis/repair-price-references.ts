import type { RepairPriceReference } from "./repair-cost-cases";

type Source = Pick<
  RepairPriceReference,
  "source" | "sourceName" | "priceLabel"
>;
type Work = Omit<RepairPriceReference, keyof Source>;

// 원문에서 작업 범위와 금액을 대조한 공개 견적 및 의뢰 게시 금액.
const references: (Source & { works: Work[] })[] = [
  {
    sourceName: "집올케어",
    source: "https://jipolcare.com/gompangi/",
    priceLabel: "업체 참고 견적",
    works: [
      {
        groups: ["mold-removal"],
        title: "창 주변 한 곳의 곰팡이 제거",
        referencePrice: "8만~20만 원",
        work: "창문 주변의 작은 부위를 제거하고 살균·건조하는 범위예요.",
      },
      {
        groups: ["mold-removal"],
        title: "벽 한 면 또는 베란다의 곰팡이 제거",
        referencePrice: "20만~50만 원",
        work: "벽 한 면이나 베란다 한 곳의 곰팡이 제거와 항균 도장을 포함해요.",
      },
      {
        groups: ["mold-removal"],
        title: "방 한 칸 곰팡이 제거와 도배",
        referencePrice: "30만~70만 원",
        work: "기존 벽지를 떼고 곰팡이 제거·건조 후 다시 도배하는 작업이에요.",
      },
      {
        groups: ["condensation"],
        title: "곰팡이 제거와 단열 보강",
        referencePrice: "70만~250만 원",
        work: "단열재를 시공하고 벽을 다시 마감하는 경우의 참고 범위예요.",
      },
    ],
  },
  {
    sourceName: "숨고",
    source: "https://soomgo.com/prices/곰팡이-제거",
    priceLabel: "플랫폼 참고 견적",
    works: [
      {
        groups: ["mold-removal"],
        title: "곰팡이 제거 서비스 견적",
        referencePrice: "8만~65만 원",
        work: "플랫폼 견적 평균은 20만 원이며 제거 범위와 추가 작업에 따라 달라요.",
      },
    ],
  },
  {
    sourceName: "신화설비",
    source: "https://www.shinhwaplumbing.co.kr/pricing",
    priceLabel: "업체 참고 견적",
    works: [
      {
        groups: ["pipe-leak"],
        title: "노출 배관 부분 수선",
        referencePrice: "15만~20만 원",
        work: "손이 닿는 배관을 부분 수리할 때의 안내 금액이에요. 누수 탐지 비용은 별도예요.",
      },
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "계량기 한 대를 쓰는 세대의 누수 검사",
        referencePrice: "20만~30만 원",
        work: "직수·온수 배관을 검사하는 비용이며 검사할 배관 수에 따라 달라요.",
      },
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "누수 탐지와 굴착 보수",
        referencePrice: "50만~150만 원",
        work: "매립 배관을 탐지하고 굴착·수리한 뒤 기본 마감까지 하는 범위예요.",
      },
      {
        groups: ["sink"],
        title: "싱크대 단순 막힘 제거",
        referencePrice: "5만~7만 원",
        work: "싱크대 한 곳의 막힘을 처리하는 안내 금액이에요.",
      },
      {
        groups: ["floor-drain"],
        title: "욕실·베란다 배수구 막힘 처리",
        referencePrice: "5만 원부터",
        work: "배수구 막힘 처리의 시작 금액이에요. 막힌 깊이와 필요한 장비를 확인해요.",
      },
      {
        groups: ["toilet"],
        title: "변기 단순 막힘 처리",
        referencePrice: "5만 원",
        work: "업체가 공개한 변기 단순 막힘 작업 기준이에요.",
      },
      {
        groups: ["boiler"],
        title: "보일러 분배기 밸브 교체",
        referencePrice: "개당 15만~20만 원",
        work: "분배기에서 문제 있는 밸브만 바꾸는 작업이에요.",
      },
      {
        groups: ["boiler"],
        title: "보일러 분배기 본체 교체",
        referencePrice: "40만~80만 원",
        work: "난방 배관 분배기 본체와 연결부 작업을 포함해요.",
      },
    ],
  },
  {
    sourceName: "우동해",
    source: "https://woodonghae.com/guide/leak-detection",
    priceLabel: "플랫폼 참고 견적",
    works: [
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "장비를 사용한 누수 탐지",
        referencePrice: "8만~25만 원",
        work: "청음·가스·열화상 장비 등으로 누수 위치를 찾는 비용이에요.",
      },
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "아파트 세대 안 누수 탐지",
        referencePrice: "15만~30만 원",
        work: "아파트 한 세대 안에서 누수 위치를 확인하는 범위예요.",
      },
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "누수 배관 부분 보수",
        referencePrice: "20만~50만 원",
        work: "탐지 뒤 손상 부위만 수선하는 비용이에요. 탐지 금액은 별도예요.",
      },
      {
        groups: ["ceiling-leak", "pipe-leak"],
        title: "누수 배관 교체·재시공",
        referencePrice: "50만~150만 원",
        work: "부분 보수보다 범위가 큰 교체 작업이며, 건물 구조에 따라 견적이 달라요.",
      },
    ],
  },
  {
    sourceName: "얼마드나",
    source: "https://ulmadna.com/blog/partial-wallpaper-cost",
    priceLabel: "플랫폼 참고 견적",
    works: [
      {
        groups: ["wallpaper-patch"],
        title: "벽 한 면 합지 조각 보수",
        referencePrice: "10만~20만 원",
        work: "1~2평 벽면을 합지로 부분 보수하는 경우의 참고 범위예요.",
      },
      {
        groups: ["wallpaper-patch"],
        title: "벽 한 면 실크 부분 도배",
        referencePrice: "20만~28만 원",
        work: "실크 벽지를 몰딩 사이 한 면에 시공하는 범위예요.",
      },
      {
        groups: ["wallpaper"],
        title: "작은방 한 칸 합지 도배",
        referencePrice: "20만~30만 원",
        work: "도배 면적 약 20㎡인 작은방의 합지 작업 기준이에요.",
      },
      {
        groups: ["wallpaper"],
        title: "작은방 한 칸 실크 도배",
        referencePrice: "30만~50만 원",
        work: "도배 면적 약 20㎡인 작은방의 실크 작업 기준이에요.",
      },
    ],
  },
  {
    sourceName: "얼마드나",
    source: "https://ulmadna.com/blog/partial-jangpan-repair-cost",
    priceLabel: "플랫폼 참고 견적",
    works: [
      {
        groups: ["flooring-patch"],
        title: "장판 한 곳 부분 교체",
        referencePrice: "5만~15만 원",
        work: "구멍이나 탄 자국이 있는 한 곳만 잘라 새 장판 조각으로 교체하는 범위예요.",
      },
      {
        groups: ["flooring-patch"],
        title: "장판 여러 곳 묶음 보수",
        referencePrice: "약 15만~25만 원",
        work: "찍힘이나 찢어짐이 네 곳 있을 때 묶어서 부분 보수하는 기준이에요.",
      },
    ],
  },
  {
    sourceName: "당근알바",
    source:
      "https://jobs.daangn.com/job-posts/부분-인테리어-보수-시공-가능하신-전문가-구합니다-tacx5j6aaiuf",
    priceLabel: "의뢰 게시 금액",
    works: [
      {
        groups: ["wallpaper-patch"],
        title: "벽지·시트지·몰딩 부분 보수 의뢰",
        referencePrice: "건당 15만 원",
        work: "거실 벽지와 신발장 시트지, 몰딩을 함께 손봐 달라는 구인 글의 제시 금액이에요.",
      },
    ],
  },
  {
    sourceName: "숨고",
    source: "https://soomgo.com/blog/interior/부분도배비용-2/",
    priceLabel: "플랫폼 참고 견적",
    works: [
      {
        groups: ["wallpaper-patch"],
        title: "1㎡ 이하 벽지 보수 출장비",
        referencePrice: "약 17만 원",
        work: "작은 벽지 손상을 보수할 때의 출장비 예시예요. 시공 총액은 작업 범위에 따라 달라요.",
      },
      {
        groups: ["wallpaper-patch"],
        title: "벽 한 면 합지 도배",
        referencePrice: "약 25만 원부터",
        work: "합지 벽지로 벽 한 면을 도배할 때의 참고 금액이에요.",
      },
      {
        groups: ["wallpaper-patch"],
        title: "벽 한 면 실크 도배",
        referencePrice: "약 30만 원부터",
        work: "실크 벽지로 벽 한 면을 도배할 때의 참고 금액이에요.",
      },
      {
        groups: ["wallpaper"],
        title: "방 한 칸 합지 도배",
        referencePrice: "약 30만~60만 원",
        work: "천장까지 포함한 방 한 칸의 합지 도배 기준이에요.",
      },
      {
        groups: ["wallpaper"],
        title: "방 한 칸 실크 도배",
        referencePrice: "약 50만~80만 원",
        work: "천장까지 포함한 방 한 칸의 실크 도배 기준이에요.",
      },
      {
        groups: ["wallpaper"],
        title: "전용 5평 원룸 전체 도배",
        referencePrice: "약 386,100원부터",
        work: "원룸 전체 기준이며 구조와 천장 포함 여부에 따라 달라요.",
      },
    ],
  },
];

export const repairPriceReferences = references.flatMap(
  ({ works, ...source }) =>
    works.map((work): RepairPriceReference => ({ ...source, ...work })),
);
