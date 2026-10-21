import type { Intake, Issue } from "./schema.js";
export const questionVersion = "questions-1.1";
export const titles = [
  "지금 보이는 증상은 무엇인가요?",
  "언제부터 보였나요?",
  "입주 때도 문제가 있었나요?",
  "원래 있던 시설인가요?",
  "원인을 확인해 보셨나요?",
  "수리 관련 계약 문구가 있나요?",
  "이미 연락하셨나요?",
];
export const descriptionHints: Record<Issue, string> = {
  mold: "예: 창문 옆 벽에 곰팡이가 생겼고, 아침에 물방울이 맺혀요.",
  leak: "예: 비가 오는 날 천장에서 물이 떨어져요.",
  boiler: "예: 보일러 전원은 켜지는데 온수가 나오지 않아요.",
  surface: "예: 방문 옆 벽지가 찢어졌어요. 입주 사진과 비교하고 싶어요.",
  drain: "예: 욕실 물이 천천히 내려가고, 다른 배수구에서도 소리가 나요.",
  fixture: "예: 집에 있던 냉장고의 전원은 켜지는데 냉장이 안 돼요.",
};
export const options = {
  safety: [
    ["none", "지금 위험 신호는 없어요"],
    ["gas", "가스 냄새가 나요"],
    ["fire", "연기·불꽃·타는 냄새가 나요"],
    ["electric", "물과 전기가 닿거나 감전이 의심돼요"],
    ["unknown", "잘 모르겠어요"],
  ],
  discovered: [
    ["today", "오늘 발견했어요"],
    ["week", "일주일 안에 발견했어요"],
    ["long", "일주일보다 오래됐어요"],
    ["unknown", "모르겠어요"],
  ],
  preexisting: [
    ["yes", "입주 때도 있었어요"],
    ["no", "입주 후 처음 생겼어요"],
    ["unknown", "모르겠어요"],
    ["na", "해당 없어요"],
  ],
  installed: [
    ["original", "집에 원래 있던 시설이에요"],
    ["own", "제가 설치한 시설이에요"],
    ["unknown", "모르겠어요"],
    ["na", "해당 없어요"],
  ],
  cause: [
    ["unknown", "아직 원인을 몰라요"],
    ["aging", "노후·시설 또는 건물 문제라는 설명"],
    ["wear", "일상적인 사용에 따른 마모라는 설명"],
    ["damage", "사용 중 파손·관리 문제라는 설명"],
    ["mixed", "여러 원인이 함께 있다는 설명"],
    ["third", "윗집·공용 배관 등 외부 원인 가능성"],
  ],
  causeSource: [
    ["self", "제가 관찰하거나 추측했어요"],
    ["landlord", "집주인이 말했어요"],
    ["technician", "점검 기사에게 들었어요"],
    ["unknown", "출처가 분명하지 않아요"],
  ],
  otherClaim: [
    ["none", "다른 설명은 없어요"],
    ["aging", "노후·시설 문제라고 해요"],
    ["wear", "일상적인 사용에 따른 마모라고 해요"],
    ["damage", "사용·관리 문제라고 해요"],
    ["mixed", "복합 원인이라고 해요"],
    ["third", "외부 원인이라고 해요"],
    ["unknown", "잘 모르겠어요"],
  ],
  contact: [
    ["no", "아직 연락하지 않았어요"],
    ["waiting", "연락했지만 답변을 기다려요"],
    ["cost", "비용을 부담하라는 답을 받았어요"],
    ["replied", "답변을 받았어요"],
    ["unknown", "모르겠어요"],
  ],
} as const;
export function answerLabel(key: keyof typeof options, value: string) {
  return options[key].find(([id]) => id === value)?.[1] ?? value;
}
export function summarize(input: Intake) {
  return [
    input.description || "별도 설명 없음",
    ...(
      [
        "discovered",
        "preexisting",
        "installed",
        "cause",
        "causeSource",
        "otherClaim",
        "contact",
      ] as const
    ).map((key) => answerLabel(key, input[key])),
    input.contract ? `계약 문구: ${input.contract}` : "계약 문구 미확인",
  ];
}

export const observations: Record<
  Issue,
  readonly (readonly [Intake["observation"], string])[]
> = {
  mold: [
    ["wall", "벽·천장에 곰팡이가 보여요"],
    ["condensation", "창문·벽에 물방울이 맺혀요"],
    ["furniture", "가구·물건 주변에 생겼어요"],
    ["unknown", "잘 모르겠어요"],
  ],
  leak: [
    ["ceiling", "천장·벽에서 물이 나와요"],
    ["pipe", "배관·설비 주변에서 새요"],
    ["rain", "비가 올 때 물이 들어와요"],
    ["unknown", "잘 모르겠어요"],
  ],
  boiler: [
    ["hotwater", "온수가 나오지 않아요"],
    ["heating", "난방이 되지 않아요"],
    ["power", "전원이 안 켜지거나 오류가 보여요"],
    ["unknown", "잘 모르겠어요"],
  ],
  surface: [
    ["wall-tear", "벽지가 찢어졌어요"],
    ["wall-dent", "벽지에 찍힘이 있어요"],
    ["floor-tear", "장판이 찢어졌어요"],
    ["floor-dent", "장판에 찍힘이 있어요"],
    ["unknown", "잘 모르겠어요"],
  ],
  drain: [
    ["poor-drain", "물이 잘 내려가지 않아요"],
    ["slow-drain", "물이 천천히 내려가요"],
    ["backflow", "물이 역류해요"],
    ["blocked-drain", "배수구가 막힌 것 같아요"],
    ["unknown", "잘 모르겠어요"],
  ],
  fixture: [
    ["aircon", "에어컨이 작동하지 않아요"],
    ["option-boiler", "보일러가 작동하지 않아요"],
    ["washer", "세탁기가 작동하지 않아요"],
    ["fridge", "냉장고가 작동하지 않아요"],
    ["stove", "인덕션/가스레인지가 작동하지 않아요"],
    ["cabinet", "수납장이 고장 났어요"],
    ["bed", "침대가 파손됐어요"],
    ["other-fixture", "다른 옵션 제품에 문제가 있어요"],
    ["unknown", "잘 모르겠어요"],
  ],
};
export function observationLabel(i: Intake) {
  return (
    observations[i.issue].find(([key]) => key === i.observation)?.[1] ??
    "잘 모르겠어요"
  );
}

export const issueChoices: { issue: Issue; title: string; detail: string }[] = [
  {
    issue: "mold",
    title: "곰팡이가 생겼어요",
    detail: "벽·천장의 곰팡이, 창문의 결로",
  },
  { issue: "leak", title: "물이 새요", detail: "천장·벽·배관 주변의 물 샘" },
  {
    issue: "surface",
    title: "벽지·장판이 손상됐어요",
    detail: "찢어짐·찍힘, 입주 당시 상태 비교",
  },
  { issue: "drain", title: "배수가 안 돼요", detail: "느린 배수·역류·막힘" },
  {
    issue: "fixture",
    title: "집에 설치된 옵션에 문제가 있어요",
    detail: "에어컨·냉장고·세탁기·침대 등",
  },
  {
    issue: "boiler",
    title: "보일러가 고장 났어요",
    detail: "난방·온수·작동 문제",
  },
];
export const issueGuidance: Record<
  Issue,
  { note: string; record: string; checks: string[] }
> = {
  mold: {
    note: "곰팡이의 색이나 위치만으로 누수·결로·관리 문제를 확정할 수 없어요.",
    record: "발생 위치·시점·결로 양상을 기록하기",
    checks: [
      "누수·단열 상태와 환기·사용 환경을 함께 점검하기",
      "도배 전 곰팡이 발생 원인과 재발 여부 확인하기",
    ],
  },
  leak: {
    note: "물자국이 생긴 곳과 실제로 물이 새기 시작한 곳은 다를 수 있어요.",
    record: "안전한 거리에서 물이 새는 위치·시점을 기록하기",
    checks: [
      "누수 발생 지점이 전용부분인지 공용부분인지 확인하기",
      "누수 탐지 결과와 피해 범위·최초 통보 기록 보관하기",
    ],
  },
  boiler: {
    note: "오류 표시와 작동하지 않는 기능을 기록하고, 임의로 분해하지 마세요.",
    record: "보이는 오류 표시와 작동하지 않는 기능을 기록하기",
    checks: [
      "보일러의 연식·점검 기록과 고장 원인 확인하기",
      "수리·교체 필요성과 견적의 항목별 내역 요청하기",
    ],
  },
  surface: {
    note: "찢어짐·찍힘을 선택하는 것은 상태 기록이에요. 사진 자동 판독이나 과실 판정은 하지 않아요.",
    record: "손상의 위치·크기와 입주 당시 기록을 비교하기",
    checks: [
      "입주 사진·교체 시기·사용 기간으로 기존 손상과 통상 마모를 구분하기",
      "부분 보수 가능 여부와 전체 교체 견적의 이유 확인하기",
    ],
  },
  drain: {
    note: "물이 안 내려간다는 사실만으로 사용자의 과실이라고 볼 수 없어요. 막힌 위치와 원인을 함께 확인해요.",
    record: "역류 시 물 사용을 멈추고, 안전한 곳에서 발생 위치·시점을 기록하기",
    checks: [
      "한 배수구만 막혔는지 여러 곳·다른 세대도 같은지 점검 요청하기",
      "이물질·배관 노후·공용관 문제를 점검 기록으로 구분하기",
    ],
  },
  fixture: {
    note: "집주인이 제공한 옵션인지, 직접 가져온 제품인지 구분해요. 옵션이라는 이유만으로 비용 부담이 정해지지는 않아요.",
    record: "제품 종류·모델·오류 표시와 작동하지 않는 기능을 기록하기",
    checks: [
      "계약서 옵션 목록·제공 주체·제품 연식·보증 및 수리 이력 확인하기",
      "노후·부품 결함·사용 중 손상 가능성과 수리 견적을 확인하기",
    ],
  },
};
