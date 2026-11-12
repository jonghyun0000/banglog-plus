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

export function isLightingIssue(input: Pick<Intake, "issue" | "observation">) {
  return (
    input.issue === "fixture" &&
    lightingObservations.some((value) => value === input.observation)
  );
}
