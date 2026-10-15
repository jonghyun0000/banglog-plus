import type { Intake, Issue } from "./schema.js";
export const questionVersion = "questions-1.0";
export const titles = [
  "어떤 상황인가요?",
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
};
export function observationLabel(i: Intake) {
  return (
    observations[i.issue].find(([key]) => key === i.observation)?.[1] ??
    "잘 모르겠어요"
  );
}
