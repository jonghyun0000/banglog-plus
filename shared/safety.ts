import type { Intake } from "./schema.js";
export const safetyUrl =
  "https://119metaverse.nfa.go.kr/occasion/kids-quiz/quiz-test";
export const safetyText =
  "비용 확인보다 안전이 먼저예요. 위험 장소에서 벗어나 안전한 곳에서 119에 도움을 요청하세요. 가스 냄새가 나면 불을 켜거나 전기 스위치를 조작하지 마세요. 젖은 전기기기나 배선을 만지거나 직접 수리하지 마세요.";
export function hasDanger(
  input: Pick<Intake, "description" | "safety" | "contract"> &
    Partial<Pick<Intake, "drain">>,
) {
  if (["gas", "fire", "electric"].includes(input.safety)) return true;
  return /가스\s*(냄새|누출)|타는\s*냄새|불꽃|화재|감전|일산화탄소|연기|전기.{0,8}(물|젖)|콘센트.{0,8}(물|젖)/u.test(
    `${input.description} ${input.contract} ${input.drain?.location === "other" ? (input.drain.locationDetail ?? "") : ""}`,
  );
}
export function outOfScope(text: string) {
  return /시공사.{0,12}(하자보수|청구)|하자\s*보증금|절도|형사\s*책임|보증금\s*반환|전세\s*사기|소송|상가|매매|해외\s*(주택|임대)/u.test(
    text,
  );
}
export function maskPersonalData(text: string) {
  return text
    .replace(/\b\d{6}\s*[- ]?\s*[1-8]\d{6}\b/g, "[주민번호 가림]")
    .replace(/\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/g, "[연락처 가림]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 가림]")
    .replace(/\b\d{2,6}-\d{2,6}-\d{2,8}\b/g, "[번호 가림]")
    .replace(
      /[가-힣]+(?:로|길)\s*\d+(?:-\d+)?(?:\s*\d+동)?(?:\s*\d+호)?/g,
      "[상세주소 가림]",
    )
    .replace(/\d+동\s*\d+호/g, "[동호수 가림]");
}
export function sanitizeIntake(input: Intake): Intake {
  return {
    ...input,
    ...(input.drain
      ? {
          drain: {
            ...input.drain,
            locationDetail:
              input.drain.location === "other"
                ? maskPersonalData(input.drain.locationDetail?.trim() ?? "")
                : undefined,
          },
        }
      : {}),
    description: maskPersonalData(input.description.trim()),
    contract: maskPersonalData(input.contract.trim()),
  };
}
