import type { Intake } from "./schema.js";

export const lightingTitle = "전구가 고장났어요";
export const lightingOptions = [
  ["light-out", "전구 한 개가 켜지지 않아요"],
  ["light-flicker", "조명이 깜빡여요"],
  ["light-replaced", "전구를 바꿔도 켜지지 않아요"],
  ["light-multiple", "여러 조명이 함께 꺼졌어요"],
  ["light-unknown", "잘 모르겠어요"],
] as const;
export const lightingObservations = lightingOptions.map(([id]) => id);
export const lightingStep = 12;
export const lightingQuestion = "어떤 형태의 조명인가요?";
export const lightingTypes = [
  ["replaceable", "전구·형광등만 바꿀 수 있어요"],
  ["integrated", "전구를 분리할 수 없는 일체형 조명이에요"],
  ["unknown", "어떤 형태인지 잘 모르겠어요"],
] as const;

export function isLightingIssue(input: Pick<Intake, "issue" | "observation">) {
  return (
    input.issue === "fixture" &&
    lightingObservations.some((value) => value === input.observation)
  );
}

export function usesSingleBulbQuestions(input: Intake) {
  return (
    input.issue === "fixture" &&
    input.observation === "light-out" &&
    input.lighting === "replaceable" &&
    (input.lightingWork?.count ?? 1) === 1 &&
    input.safety === "none"
  );
}

export function lightingRoute(input: Intake) {
  if (
    (input.lightingWork?.count ?? 1) > 1 ||
    input.lighting === "integrated" ||
    ["light-replaced", "light-multiple", "light-flicker"].includes(
      input.observation,
    )
  )
    return "inspection";
  if (usesSingleBulbQuestions(input) && input.preexisting === "no")
    return "bulb";
  return "check";
}
