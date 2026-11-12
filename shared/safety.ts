import { applyQuestionPatch, intakeDetails } from "./questions.js";
import type { Intake } from "./schema.js";
// 국민안전24 국민행동요령 "전기·가스 사고". 2026-11-10 원문 확인.
export const safetyUrl =
  "https://www.safekorea.go.kr/safekorea-kor/acts/nacts/action-guide.do?category=electircGasAccident&actsHeaderTitle=%EC%A0%84%EA%B8%B0%C2%B7%EA%B0%80%EC%8A%A4%20%EC%82%AC%EA%B3%A0&menuSn=4";
export const safetyText =
  "비용 확인보다 안전이 먼저예요. 위험 장소에서 벗어나 안전한 곳에서 119에 도움을 요청하세요. 가스 냄새가 나면 불을 켜거나 전기 스위치를 조작하지 마세요. 젖은 전기기기나 배선을 만지거나 직접 수리하지 마세요.";
export function hasDanger(
  input: Pick<Intake, "description" | "safety" | "contract"> &
    Partial<Pick<Intake, "drain" | "details" | "contact">>,
) {
  if (["gas", "fire", "electric"].includes(input.safety)) return true;
  const context = `${input.description} ${input.contract} ${input.details?.technicianNote ?? ""} ${input.details?.reply ?? ""} ${input.details?.location ?? ""} ${input.details?.impact ?? ""} ${input.drain?.location === "other" ? (input.drain.locationDetail ?? "") : ""}`;
  return dangerPattern.test(context) || englishDangerPattern.test(context);
}
const englishDangerPattern =
  /\b(?:smell(?:ing)?\s+(?:of\s+)?gas|gas\s+(?:is\s+)?leak(?:ing)?|burning\s+smell|smoke\s+(?:is\s+)?(?:coming|rising)|(?:outlet|socket|wiring|fixture|wire)\s+(?:is\s+)?(?:sparking|wet)|sparks?\s+(?:from|coming)|(?:got|was)\s+(?:an?\s+)?(?:electric\s+)?shock(?:ed)?|electric\s+shock|carbon\s+monoxide\s+alarm)\b/iu;
// 단어만 겹치는 일상 표현(일정 연기, 화재보험, 연기 감지기)은 위험으로 보지 않는다.
const dangerPattern = new RegExp(
  [
    "가스\\s*(냄새|누출)",
    "가스가?\\s*(새|샌|샜)",
    "타는\\s*냄새",
    "불꽃|스파크",
    "불이\\s*(났|나요|나고|붙)",
    "화재\\s*(가\\s*)?(났|나요|발생)",
    "화재\\s*경보.{0,8}울",
    "연기\\s*(가\\s*)?(나요|나고|나는|났|올라|피어|자욱|가득)",
    "연기\\s*냄새",
    "감전",
    "누전(?!\\s*차단기)",
    "누전\\s*차단기.{0,10}(내려|떨어|작동|꺼)",
    "일산화탄소|CO\\s*경보",
    "전기.{0,8}(물|젖)",
    "콘센트.{0,8}(물|젖)",
  ].join("|"),
  "u",
);
// 범위 밖 주제를 직접 묻는 경우만 막는다. 수리 상황에서 지나가며 언급한
// 보증금 공제·소송 언급·상가주택·집주인 변경은 지원 범위 안이다.
const scopePattern = new RegExp(
  [
    "시공사.{0,12}(하자보수|청구)",
    "하자\\s*보증금",
    "절도",
    "형사\\s*책임",
    "보증금\\s*반환.{0,12}(청구|소송|못\\s*받|안\\s*(해|돌려))",
    "전세\\s*사기",
    "소송.{0,8}(방법|절차|준비|비용|하려|하고\\s*싶)",
    "상가\\s*(임대차|점포|매장)",
    "매매\\s*(계약|대금|하자)",
    "해외\\s*(주택|임대)",
  ].join("|"),
  "u",
);
export function outOfScope(text: string) {
  return (
    /^\s*보증금\s*반환\s*[?.!？]*\s*$/u.test(text) || scopePattern.test(text)
  );
}
const digits = (text: string) => text.replace(/\D/g, "").length;
// 입주일·발견일 같은 날짜는 분쟁 기록에 필요하므로 가리지 않는다.
const isDate = (text: string) =>
  /^(?:19|20)\d{2}[- ](?:0[1-9]|1[0-2])[- ](?:0[1-9]|[12]\d|3[01])$/.test(text);
export function maskPersonalData(text: string) {
  return text
    .replace(/\b\d{6}\s*[- ]?\s*[1-8]\d{6}\b/g, "[주민번호 가림]")
    .replace(/\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/g, "[연락처 가림]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 가림]")
    .replace(/\b\d{2,6}(?:[- ]\d{2,8}){2,3}\b/g, (match) =>
      isDate(match) || (match.includes(" ") && digits(match) < 10)
        ? match
        : "[번호 가림]",
    )
    .replace(/\b\d{10,14}\b/g, "[번호 가림]")
    .replace(
      /[가-힣]+(?:로|길)\s*\d+(?:-\d+)?(?:\s*\d+동)?(?:\s*\d+호)?/g,
      "[상세주소 가림]",
    )
    .replace(/\d+동\s*\d+호/g, "[동호수 가림]");
}
function maskAnswer(text: string, limit: number) {
  const masked = maskPersonalData(text.trim());
  // Short values can grow when replaced by a label. Compact the labels
  // before applying the limit so the end of a supported answer is retained.
  return masked.length <= limit
    ? masked
    : masked
        .replace(
          /\[(?:주민번호|연락처|이메일|번호|상세주소|동호수) 가림\]/g,
          "*",
        )
        .slice(0, limit);
}
export function sanitizeIntake(input: Intake): Intake {
  const normalized = applyQuestionPatch(input, {});
  return {
    ...normalized,
    ...(normalized.details
      ? {
          details: {
            ...normalized.details,
            location: maskAnswer(normalized.details.location, 120),
            impact: maskAnswer(normalized.details.impact, 240),
            technicianNote: maskAnswer(normalized.details.technicianNote, 320),
            reply: maskAnswer(normalized.details.reply, 320),
          },
        }
      : {}),
    ...(input.drain
      ? {
          drain: {
            ...input.drain,
            locationDetail:
              input.drain.location === "other"
                ? maskAnswer(input.drain.locationDetail ?? "", 80)
                : undefined,
          },
        }
      : {}),
    description: maskAnswer(input.description, 1000),
    contract: maskAnswer(input.contract, 300),
  };
}

export function intakeContext(input: Intake) {
  return [
    input.description,
    ...intakeDetails(input).map(([label, value]) => `${label}: ${value}`),
  ]
    .filter(Boolean)
    .join("\n");
}
