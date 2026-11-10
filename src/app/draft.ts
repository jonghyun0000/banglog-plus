import { intakeSchema } from "../../shared/schema";
import type { Intake } from "../../shared/schema";

// 작성 중인 입력만 이 탭의 sessionStorage에 둔다. 결과·토큰·동의 여부는
// 저장하지 않는다. 탭을 닫거나 사용자가 지우면 사라진다.
const KEY = "banglog-plus.draft.v1";
export type Draft = {
  input: Intake;
  screen: "questions" | "review";
  step: number;
};
export function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Draft>;
    const input = intakeSchema.safeParse(value.input);
    const step = Number(value.step);
    if (
      !input.success ||
      (value.screen !== "questions" && value.screen !== "review") ||
      !Number.isInteger(step) ||
      step < 0 ||
      step > 6
    ) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return { input: input.data, screen: value.screen, step };
  } catch {
    return null;
  }
}
export function saveDraft(draft: Draft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 저장소를 쓸 수 없으면 기존처럼 메모리에서만 동작한다.
  }
}
export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 지울 저장소가 없으면 할 일이 없다.
  }
}
