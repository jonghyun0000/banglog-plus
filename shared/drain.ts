import { hasReply } from "./questions.js";
import { defaultDrain, type Intake, type Analysis } from "./schema.js";
import { hasDanger, intakeContext } from "./safety.js";
import { isLightingIssue, lightingStep } from "./lighting.js";

export const drainOptions = {
  location: [
    ["basin", "세면대"],
    ["sink", "주방 싱크대"],
    ["floor", "욕실 바닥 배수구"],
    ["toilet", "변기"],
    ["other", "직접 입력하기"],
    ["unknown", "잘 모르겠어요"],
  ],
  scope: [
    ["single", "이곳 한 군데만 그래요"],
    ["multiple", "여러 배수구가 함께 그래요"],
    ["unknown", "다른 곳은 아직 확인하지 못했어요"],
  ],
  overflow: [
    ["no", "넘치거나 주변으로 새지는 않아요"],
    ["yes", "물이 넘치거나 주변으로 새고 있어요"],
    ["unknown", "잘 모르겠어요"],
  ],
  chemical: [
    ["no", "배수구 약품은 넣지 않았어요"],
    ["yes", "배수구 약품을 넣었어요"],
    ["unknown", "약품 사용 여부를 모르겠어요"],
  ],
  attempted: [
    ["none", "아직 해본 조치는 없어요"],
    ["cleaned", "보이는 이물질을 치웠지만 그대로예요"],
    ["tool", "압축기·제거 도구를 써도 그대로예요"],
    ["professional", "업체가 점검했지만 해결되지 않았어요"],
    ["unknown", "잘 모르겠어요"],
  ],
} as const;
export const drainQuestions = {
  7: { key: "location", title: "어디의 배수가 안 되나요?", phase: "증상 확인" },
  8: {
    key: "scope",
    title: "다른 배수구도 함께 막혔나요?",
    phase: "증상 확인",
  },
  9: {
    key: "overflow",
    title: "물이 넘치거나 주변으로 새나요?",
    phase: "안전 확인",
  },
  10: {
    key: "chemical",
    title: "배수구에 약품을 넣었나요?",
    phase: "해본 조치",
  },
  11: {
    key: "attempted",
    title: "이미 해본 조치가 있나요?",
    phase: "해본 조치",
  },
} as const;
export function drainFacts(i: Intake) {
  if (i.issue !== "drain") return [];
  const d = i.drain ?? defaultDrain;
  return (Object.keys(drainOptions) as (keyof typeof drainOptions)[])
    .filter((key) => key !== "attempted" || questionSteps(i).includes(11))
    .map((key) => ({
      key: `drain.${key}`,
      value:
        key === "location" && d.location === "other"
          ? d.locationDetail?.trim() || "기타 배수 위치 (상세 미입력)"
          : (drainOptions[key].find(([v]) => v === d[key])?.[1] ?? "미확인"),
      provenance: "tenant_report" as const,
    }));
}
export function drainEscalation(i: Intake) {
  const d = i.drain ?? defaultDrain;
  return (
    hasDanger(i) ||
    i.observation === "backflow" ||
    d.scope === "multiple" ||
    d.overflow === "yes"
  );
}
export function questionSteps(i: Intake): number[] {
  const d = i.drain ?? defaultDrain;
  return [
    0,
    5,
    ...(isLightingIssue(i) ? [lightingStep] : []),
    ...(i.issue === "drain"
      ? [
          7,
          8,
          9,
          10,
          ...(!drainEscalation(i) && d.chemical === "no" ? [11] : []),
        ]
      : []),
    1,
    ...(i.issue === "drain" ? [] : [2]),
    4,
    ...(hasReply(i) || i.details?.inspection === "yes" ? [3] : []),
    6,
  ];
}

export function adjacentQuestion(i: Intake, step: number, direction: 1 | -1) {
  const steps = questionSteps(i);
  const index = steps.indexOf(step);
  return steps[index + direction] ?? (direction === 1 ? 6 : 0);
}
export function drainGuide(i: Intake): Analysis["drainGuide"] {
  if (i.issue !== "drain" || hasDanger(i)) return undefined;
  const d = i.drain ?? defaultDrain;
  // Unstructured reports can override reassuring selections. Uncertainty never enables DIY.
  const uncertainText =
    /약품|세정제|락스|뚫어뻥|역류|넘치|누수|새고|여러\s*(곳|배수구)/u.test(
      intakeContext(i),
    );
  const canTry =
    !drainEscalation(i) &&
    !uncertainText &&
    d.scope === "single" &&
    d.overflow === "no" &&
    d.chemical === "no" &&
    i.safety === "none" &&
    ["basin", "sink", "floor"].includes(d.location) &&
    ["none", "cleaned"].includes(d.attempted) &&
    i.preexisting === "no" &&
    ["poor-drain", "slow-drain", "blocked-drain"].includes(i.observation);
  const stop = drainEscalation(i);
  const contacted = ["waiting", "cost", "replied"].includes(i.contact);
  const contact = contacted
    ? "집주인·관리 담당자에게 현재도 해결되지 않았다는 점과 해본 조치를 전달하고 점검 일정·결과를 확인하세요. 비용 요구를 받았다면 원인과 항목별 견적을 먼저 요청하세요."
    : "집주인·관리 담당자에게 증상과 발견 시점, 이미 해본 조치를 알리고 점검 일정을 요청하세요.";
  const first = stop
    ? {
        title: "물 사용을 멈추고 점검을 요청해요",
        body: "역류·넘침 또는 여러 곳의 막힘은 직접 뚫으려 하지 마세요. 물 사용을 멈추고, 오염수와 젖은 전기기기를 피한 뒤 안전한 곳에서 집주인·관리 담당자에게 연락하세요.",
      }
    : canTry
      ? d.attempted === "none"
        ? {
            title: "눈에 보이는 이물질부터 확인해요",
            body: "머리카락·비누 찌꺼기 등이 원인일 수 있어요. 장갑을 끼고, 분해하지 않고 닿는 거름망 표면의 이물질만 제거해 보세요. 배관이나 고정된 마개를 풀거나 도구를 억지로 밀어 넣지 마세요.",
          }
        : {
            title: "이미 한 청소는 반복하지 않아도 돼요",
            body: "표면 청소 후에도 그대로라면 더 깊이 분해하거나 같은 작업을 반복하지 마세요. 해결되지 않은 증상과 이미 해본 청소를 집주인·관리 담당자에게 알리고 점검을 요청하세요.",
          }
      : {
          title:
            d.chemical !== "no"
              ? "약품을 더 넣거나 도구를 쓰지 마세요"
              : "직접 작업보다 점검이 먼저예요",
          body:
            d.chemical !== "no"
              ? "약품을 사용했거나 사용 여부를 모르면 다른 세제·약품을 섞지 말고 압축기나 제거 도구도 사용하지 마세요. 제품 용기·설명서를 보관하고 점검 담당자에게 제품명과 사용 시점을 알려주세요."
              : i.preexisting === "yes"
                ? "입주 때부터 있었던 문제라면 당시 사진과 연락 기록을 확인하세요. 직접 분해하기보다 집주인에게 상태와 점검 필요성을 알려주세요."
                : "이미 도구·업체 점검을 시도했거나 막힌 범위·안전 상태가 분명하지 않아요. 같은 조치를 반복하거나 배관을 분해하지 말고 현재 상태를 전달해 점검을 요청하세요.",
        };
  return {
    version: "drain-care-1.2",
    route: stop ? "stop" : canTry ? "self_check" : "contact",
    title: canTry
      ? "안전하게 확인하고, 안 되면 연락해요"
      : "지금은 직접 작업을 멈추고 확인해요",
    steps: [
      first,
      {
        title: canTry
          ? "그대로라면 집주인에게 연락해요"
          : "점검에 필요한 내용을 전달해요",
        body: contact,
      },
      {
        title: "원인 확인 후 비용을 협의해요",
        body: "입주 후 발생했거나 간단한 조치로 해결되지 않았다는 이유만으로 사용자 과실·배관 하자·비용 부담을 확정할 수 없어요. 점검 결과와 계약 조건을 확인하세요.",
      },
    ],
    warning:
      "배수구 약품을 사용한 뒤에는 압축기를 쓰지 마세요. 약품을 혼합하거나 배관을 분해하지 말고, 역류·넘침·물과 전기의 접촉이 생기면 작업을 중단하세요.",
    sources: [
      {
        title: "연수구 · 우리 집 하수도 바로 알기 (한국어 PDF, 3쪽)",
        url: "https://www.yeonsu.go.kr/UpFiles/board_1/%EC%9A%B0%EB%A6%AC%EC%A7%91%ED%95%98%EC%88%98%EB%8F%84%EB%B0%94%EB%A1%9C%EC%95%8C%EA%B8%B0.pdf#page=3",
      },
      {
        title: "한국소비자원 · 욕실세정제 혼합 사용 주의 (한국어)",
        url: "https://www.kca.go.kr/smartconsumer/sub.do?menukey=7714&mode=view&no=1002775535&page=107",
      },
    ],
  };
}

export function drainMessage(i: Intake): string {
  const d = i.drain ?? defaultDrain;
  const location = drainFacts(i).find((f) => f.key === "drain.location")?.value;
  const lines: string[] = [];
  if (d.location !== "unknown")
    lines.push(`문제가 생긴 곳은 ${location}입니다.`);
  if (d.scope === "multiple")
    lines.push("여러 배수구에서 함께 증상이 나타납니다.");
  if (d.scope === "single")
    lines.push("현재 확인한 바로는 이곳 한 군데에서 증상이 나타납니다.");
  if (d.overflow === "yes") lines.push("물이 넘치거나 주변으로 새고 있습니다.");
  if (d.overflow === "no")
    lines.push(
      "지금까지 물이 넘치거나 주변으로 새는 것은 확인하지 못했습니다.",
    );
  if (d.chemical === "yes")
    lines.push(
      "배수구 약품을 사용한 상태입니다. 점검 전에 사용한 제품을 알려드리겠습니다.",
    );
  if (d.chemical === "no") lines.push("배수구 약품은 사용하지 않았습니다.");
  const attempted = {
    none: "아직 직접 조치하지 않았습니다.",
    cleaned: "보이는 이물질을 제거했지만 증상이 계속됩니다.",
    tool: "압축기·제거 도구를 사용했지만 해결되지 않았습니다.",
    professional: "업체 점검 후에도 증상이 계속됩니다.",
    unknown: "",
  }[d.attempted];
  // Skipped actions must not be presented as a fresh claim after a branch change.
  if (questionSteps(i).includes(11) && attempted) lines.push(attempted);
  return lines.length ? lines.join("\n") + "\n" : "";
}
