import type { Analysis, Intake } from "../../../shared/schema";
import { repairPriceReferences } from "./repair-price-references";

type CaseGroup =
  | "condensation"
  | "mold-removal"
  | "ceiling-leak"
  | "pipe-leak"
  | "wallpaper"
  | "wallpaper-patch"
  | "flooring"
  | "flooring-patch"
  | "sink"
  | "basin"
  | "toilet"
  | "floor-drain"
  | "sink-backflow"
  | "balcony-backflow"
  | "shared-drain"
  | "boiler"
  | "heating-distributor"
  | "aircon";

type RepairWork = {
  groups: readonly CaseGroup[];
  title: string;
  work: string;
  source: string;
};

type RepairCostCase = RepairWork & {
  publishedBudget: number;
  location: string;
  posted: string;
};

export type RepairPriceReference = RepairWork & {
  referencePrice: string;
  priceLabel: "업체 참고 견적" | "플랫폼 참고 견적" | "의뢰 게시 금액";
  sourceName: string;
};

export type RepairCostEntry = RepairCostCase | RepairPriceReference;

export type CostPreview = {
  label: string;
  amount?: string;
  action: string;
};

const krw = new Intl.NumberFormat("ko-KR");
const compactKrw = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 2,
});
export function formatRepairBudget(won: number) {
  return `${krw.format(won)}원`;
}

// Each amount is the portfolio's public budget field. Only reviewed source
// pages belong here; the public figures do not establish a payment or payer.
const cases: readonly RepairCostCase[] = [
  {
    groups: ["condensation"],
    title: "세탁실 벽 단열 보강",
    work: "결로가 반복된 세탁실 외벽에 단열을 보강하고 단열 페인트로 마감했어요.",
    publishedBudget: 1000000,
    location: "서울 송파구",
    posted: "2025.11",
    source: "https://soomgo.com/portfolio/detail/691bce609e4d7ee0b1a5b2ce",
  },
  {
    groups: ["condensation"],
    title: "벽 곰팡이와 단열 보강",
    work: "결로와 곰팡이가 생긴 벽에 단열재를 붙이고 탄성 코팅으로 마감했어요.",
    publishedBudget: 800000,
    location: "경기 부천시",
    posted: "2023.11",
    source: "https://soomgo.com/portfolio/detail/69086873d16fbb3fbe937fbb",
  },
  {
    groups: ["ceiling-leak", "pipe-leak"],
    title: "천장 속 배관 부분 교체와 복구",
    work: "누수 지점을 찾아 갈라진 배관 구간을 교체하고 젖은 단열재와 석고보드를 복구했어요.",
    publishedBudget: 600000,
    location: "서울",
    posted: "2025.11",
    source: "https://soomgo.com/portfolio/detail/690f526ff6af9934b43cd1b2",
  },
  {
    groups: ["ceiling-leak", "pipe-leak"],
    title: "천장 매립 배관 연결 수리",
    work: "천장 위 손상된 배관 구간을 잘라 연결 부속으로 수리하고 압력을 점검했어요.",
    publishedBudget: 800000,
    location: "인천",
    posted: "2025.11",
    source: "https://soomgo.com/portfolio/detail/690f5e8826c738fb33fb3414",
  },
  {
    groups: ["wallpaper"],
    title: "방 한 칸과 거실 벽면 도배",
    work: "기존 벽지를 제거하고 바탕 작업 후 실크 벽지로 방 한 칸과 거실 벽면을 마감했어요.",
    publishedBudget: 330000,
    location: "대구 남구",
    posted: "2023.05",
    source: "https://soomgo.com/portfolio/detail/69083f73bc65844bee96eb1d",
  },
  {
    groups: ["flooring"],
    title: "복층 주택 방 3개와 거실 장판 교체",
    work: "복층 주택의 방 세 개와 거실 장판을 전체 교체했어요.",
    publishedBudget: 1100000,
    location: "충북 청주시",
    posted: "2026.09",
    source: "https://soomgo.com/portfolio/detail/6a97434a55fa462d19fca316",
  },
  {
    groups: ["boiler"],
    title: "노후 가스보일러 본체 교체",
    work: "난방 효율이 낮아진 20평대 아파트의 가스보일러를 교체했어요.",
    publishedBudget: 500000,
    location: "서울 강동구",
    posted: "2026.02",
    source:
      "https://soomgo.com/portfolio/detail/698be376394964f6f3535765?from=portfolio_detail",
  },
  {
    groups: ["boiler"],
    title: "배수구 위치를 고려한 보일러 설치",
    work: "배수구까지의 거리를 고려해 일반 저녹스 보일러를 설치했어요.",
    publishedBudget: 750000,
    location: "서울 중구",
    posted: "2024.06",
    source: "https://soomgo.com/portfolio/detail/690869aad16fbb3fbe9641b0",
  },
  {
    groups: ["basin"],
    title: "세면대 트랩 청소와 배수 마개 교체",
    work: "트랩과 배수관의 이물질을 제거하고 파손된 배수 마개를 교체했어요.",
    publishedBudget: 100000,
    location: "부산 강서구",
    posted: "2026.06",
    source:
      "https://soomgo.com/portfolio/detail/6a36732dfa098b0effd45751?from=portfolio_detail",
  },
  {
    groups: ["sink"],
    title: "아파트 싱크대 배관 막힘 제거",
    work: "내시경으로 막힌 위치를 확인하고 배관에 쌓인 기름때와 이물질을 제거했어요.",
    publishedBudget: 50000,
    location: "경기",
    posted: "2026.06",
    source: "https://soomgo.com/portfolio/detail/6a38ce0c93ec67cf62db2923",
  },
  {
    groups: ["sink-backflow"],
    title: "싱크대 반복 막힘·역류 배관 작업",
    work: "앞서 작업한 뒤 막힘이 반복된 현장에서 안팎의 배관 흐름을 확인하고 막힌 구간을 작업했어요.",
    publishedBudget: 300000,
    location: "경남 창원시",
    posted: "2025.11",
    source:
      "https://soomgo.com/portfolio/detail/691127a202b3d40127da6f34?from=portfolio_detail",
  },
  {
    groups: ["sink-backflow"],
    title: "싱크대 역류와 배관 경사 보완",
    work: "배관에 쌓인 기름때를 제거하고 물이 고이는 배관 구간을 손봤어요.",
    publishedBudget: 250000,
    location: "경기 용인시",
    posted: "2026.04",
    source: "https://soomgo.com/portfolio/detail/69d3b3092cf76adb7735f321",
  },
  {
    groups: ["floor-drain"],
    title: "욕실 바닥 배수구 막힘 제거",
    work: "인테리어 후 욕실 배수구 트랩에 남은 시멘트와 공사 잔해를 제거했어요.",
    publishedBudget: 50000,
    location: "경기 오산시",
    posted: "2026.10",
    source:
      "https://soomgo.com/portfolio/detail/6ac50585df01233cd8a889ce?from=region_recommendation&locationEntryMethod=%EC%B5%9C%EA%B7%BC%EC%9D%B8%EA%B8%B0%EC%82%AC%EB%A1%80",
  },
  {
    groups: ["balcony-backflow"],
    title: "베란다 하수구 역류 처리",
    work: "고인 물을 빼고 배관을 내시경으로 확인한 뒤 전문 장비로 세척했어요.",
    publishedBudget: 40000,
    location: "인천",
    posted: "2026.02",
    source: "https://soomgo.com/portfolio/detail/698df70040bcd6b4c7f318dc",
  },
  {
    groups: ["shared-drain"],
    title: "원룸 건물의 주방·욕실 연결 배관 청소",
    work: "싱크대와 욕실 배수가 만나는 배관을 내시경으로 확인하고 쌓인 이물질을 제거했어요.",
    publishedBudget: 300000,
    location: "서울 마포구",
    posted: "2026.09",
    source:
      "https://soomgo.com/portfolio/detail/6ab0bbf5347f4b829182016e?from=portfolio_detail",
  },
  {
    groups: ["toilet"],
    title: "변기 배관 안쪽 막힘 제거",
    work: "변기를 분리한 뒤 배관 안쪽에 오래 쌓인 이물질을 제거한 작업이에요.",
    publishedBudget: 250000,
    location: "서울 마포구",
    posted: "2026.09",
    source:
      "https://soomgo.com/portfolio/detail/6aab5ec0dfad98e2b11a507a?from=portfolio_detail",
  },
  {
    groups: ["aircon"],
    title: "가정용 에어컨 실외기 연결부 수리",
    work: "냉매가 반복해서 새는 부위를 찾아 실외기 연결부를 수리했어요.",
    publishedBudget: 230000,
    location: "울산 남구",
    posted: "2026.03",
    source: "https://soomgo.com/portfolio/detail/69a7fd5e97fb8a05dc903fa1",
  },
  {
    groups: ["aircon"],
    title: "천장형 시스템 에어컨 누설 수리",
    work: "냉매가 새는 부위를 탐지하고 용접 보수 후 냉매를 충전했어요.",
    publishedBudget: 500000,
    location: "인천 연수구",
    posted: "2026.07",
    source:
      "https://soomgo.com/portfolio/detail/6a635d8480207609295d8368?from=portfolio_detail",
  },
];

function matchingGroups(input: Intake): readonly CaseGroup[] {
  switch (input.issue) {
    case "mold":
      if (input.observation === "condensation") return ["condensation"];
      if (input.observation === "wall") return ["mold-removal"];
      return [];
    case "leak":
      if (input.observation === "pipe") return ["pipe-leak"];
      if (input.observation === "ceiling") return ["ceiling-leak"];
      return [];
    case "surface":
      if (input.observation.startsWith("floor-")) return ["flooring-patch"];
      if (input.observation.startsWith("wall-")) return ["wallpaper-patch"];
      return [];
    case "boiler":
      if (input.observation === "heating")
        return ["boiler", "heating-distributor"];
      if (input.observation === "hotwater") return ["boiler"];
      return [];
    case "fixture":
      switch (input.observation) {
        case "option-boiler":
          return ["boiler"];
        case "aircon":
          return ["aircon"];
        default:
          return [];
      }
    case "drain":
      if (input.drain?.scope === "multiple") return ["shared-drain"];
      if (input.drain?.scope !== "single") return [];
      if (input.observation === "backflow") {
        if (input.drain.location === "sink") return ["sink-backflow"];
        if (
          input.drain.location === "other" &&
          /^(?:베란다|발코니)(?:\s*(?:바닥|배수구|하수구))?$/.test(
            input.drain.locationDetail?.trim() ?? "",
          )
        )
          return ["balcony-backflow"];
        return [];
      }
      switch (input.drain.location) {
        case "floor":
          return ["floor-drain"];
        case "sink":
        case "basin":
        case "toilet":
          return [input.drain.location];
        default:
          return [];
      }
  }
}

export function repairCostCases(
  input: Intake,
  resultStatus: Analysis["status"],
): RepairCostEntry[] {
  if (
    resultStatus === "safety_priority" ||
    resultStatus === "out_of_scope" ||
    resultStatus === "failed" ||
    input.drain?.overflow === "yes"
  )
    return [];
  const groups = matchingGroups(input);
  return [...cases, ...repairPriceReferences].filter((item) =>
    item.groups.some((group) => groups.includes(group)),
  );
}

export function repairCostPreview(
  items: RepairCostEntry[],
): CostPreview | null {
  if (!items.length) return null;
  const action = `${items.length}건 보기`;
  const budgets = items.flatMap((item) =>
    "publishedBudget" in item ? [item.publishedBudget] : [],
  );
  if (budgets.length) {
    const low = Math.min(...budgets);
    const high = Math.max(...budgets);
    return {
      action,
      label: "시공 사례 공개 예산",
      amount:
        low === high
          ? `${compactKrw.format(low)} 원`
          : `${compactKrw.format(low)}~${compactKrw.format(high)} 원`,
    };
  }
  const references = items.filter((item) => "referencePrice" in item);
  const reference =
    references.find((item) => item.priceLabel !== "의뢰 게시 금액") ??
    references[0];
  return {
    action,
    label: reference?.priceLabel ?? "관련 수리비",
    amount: reference?.referencePrice,
  };
}
