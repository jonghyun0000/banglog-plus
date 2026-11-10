import { z } from "zod";
export const buildingSchema = z
  .object({
    use: z.string().max(80),
    structure: z.string().max(80),
    approval: z.string().regex(/^(\d{8})?$/),
    floors: z.number().int().min(0).max(200),
    checkedAt: z.string().datetime(),
    repairHistory: z.enum(["yes", "no", "unknown"]).default("unknown"),
    manager: z.enum(["yes", "no", "unknown"]).default("unknown"),
  })
  .strict();
export type Building = z.infer<typeof buildingSchema>;
export function buildingQuestions(b: Building, issue: string) {
  const year = Number(b.approval.slice(0, 4));
  return {
    repair:
      year > 1800 && new Date(b.checkedAt).getUTCFullYear() - year >= 20
        ? "사용승인 후 20년 이상 지났어요. 문제 부위의 교체·수리 이력을 알고 있나요?"
        : "문제가 생긴 부위의 교체·수리 이력을 알고 있나요?",
    manager: /공동주택|아파트|오피스텔/.test(b.use) || b.floors > 1,
    part: ["drain", "leak"].includes(issue)
      ? "배관"
      : issue === "surface"
        ? "벽지·장판"
        : "시설",
  };
}
export function buildingFacts(b?: Building) {
  if (!b) return [];
  return [
    {
      key: "building",
      value: `사용자가 선택·확인한 건축물대장 정보: 용도 ${b.use}, 구조 ${b.structure}, 사용승인일 ${b.approval || "미확인"}, 지상 ${b.floors}층. 조회시각 ${b.checkedAt}. 사용자가 답한 수리 이력 ${b.repairHistory}, 관리 담당자 ${b.manager}. 승인일은 설비 연식이나 원인·책임을 증명하지 않음.`,
      provenance: "tenant_report" as const,
    },
  ];
}

export const buildingGuideSchema = z.object({
  version: z.literal("building-guide-1"),
  repairTitle: z.string(),
  repairExplanation: z.string(),
  evidence: z.array(z.string()),
  contactTitle: z.string(),
  recipient: z.enum(["manager", "landlord", "service"]),
  contactSteps: z.array(z.string()),
  caution: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })),
});
export function buildingGuide(b: Building | undefined, ownFixture = false) {
  if (!b) return undefined;
  const repair = {
    yes: {
      title: "수리 이력은 원인을 확인하는 자료예요",
      explanation:
        "이전에 수리한 부위와 같은 곳에서 문제가 반복됐다면 과거 점검 내용과 현재 원인을 비교해 보세요. 기존 결함·시공 문제인지, 새로 발생한 손상인지 구분하는 데 도움이 돼요. 수리한 적이 있다는 이유만으로 집주인·세입자·업체의 배상책임이 확정되지는 않아요.",
      evidence: [
        "수리한 부위·시기와 재발 시점을 정리하세요.",
        "이전 점검서·영수증·보증 조건과 수리 전후 사진을 모으세요.",
        "점검 기사에게 이전 수리와 이번 문제의 관련성을 기록으로 요청하세요.",
      ],
    },
    no: {
      title: "수리 이력만으로 책임이 정해지지는 않아요",
      explanation:
        "알고 있는 이력이 없다는 답변은 실제로 수리한 적이 없다는 증거가 아니에요. 노후·시설 결함인지, 사용 중 파손이나 관리 문제인지 별도 점검이 필요해요. 건물 사용승인일만으로 설비의 연식이나 배상책임을 정할 수 없어요.",
      evidence: [
        "집주인에게 설치·교체·수리 기록이 있는지 요청하세요.",
        "입주 당시 사진과 현재 상태를 비교하세요.",
        "원인과 필요한 수리 범위가 적힌 점검서를 요청하세요.",
      ],
    },
    unknown: {
      title: "수리 이력을 모르면 기록부터 확인해요",
      explanation:
        "수리 이력을 모른다는 이유로 비용 부담을 인정할 필요는 없어요. 집주인이나 관리 담당자에게 이전 점검·교체 기록을 문의하고, 실제 원인과 계약 내용을 확인한 뒤 비용을 협의하세요.",
      evidence: [
        "집주인·관리 담당자에게 이전 고장과 수리 기록을 문의하세요.",
        "증상·발견 시점과 사진을 남기세요.",
        "점검 전에 비용과 작업 범위를 확인하세요.",
      ],
    },
  }[b.repairHistory];
  const contact = ownFixture
    ? {
        title: "직접 소유한 제품은 제조사·수리업체에",
        recipient: "service" as const,
        steps: [
          "제조사 서비스센터나 수리업체에 제품 점검과 보증 적용 여부를 문의하세요.",
          "누수 등으로 집의 시설에도 영향이 있으면 집주인에게 상황을 알리고, 연락할 관리 담당자가 있다면 피해 범위도 확인하세요.",
          "수리 진행 전 견적과 비용 부담을 확인하세요.",
        ],
      }
    : b.manager === "yes"
      ? {
          title: "연락할 관리 담당자에게 점검을 요청하세요",
          recipient: "manager" as const,
          steps: [
            "알고 있는 관리사무소·관리 담당자에게 증상과 발생 위치를 알리고 점검 가능 여부를 문의하세요.",
            "집주인에게도 같은 내용을 보내 수리 필요 사실과 진행 상황을 공유하세요. 관리 담당자에게 알린 것만으로 집주인에게 통지됐다고 단정하지 마세요.",
            "담당자에게 처리 권한이 없거나 응답이 없으면 집주인에게 점검 업체와 일정을 정해 달라고 요청하세요.",
          ],
        }
      : b.manager === "no"
        ? {
            title: "알고 있는 담당자가 없으면 집주인에게",
            recipient: "landlord" as const,
            steps: [
              "임대차계약서나 기존 연락 내역의 집주인 연락처로 증상·사진·발견 시점을 보내세요.",
              "집주인에게 관리 담당자 또는 점검 업체의 연락처와 방문 일정을 요청하세요.",
              "연락처를 찾지 못하면 계약을 진행한 중개사에게 연락 전달을 요청할 수 있어요. 중개사가 수리비를 부담하는 사람이라는 뜻은 아니에요.",
            ],
          }
        : {
            title: "담당자가 있는지 모르면 집주인에게 먼저",
            recipient: "landlord" as const,
            steps: [
              "집주인에게 수리가 필요한 상황을 알리고 담당 관리사무소나 관리인의 유무를 확인하세요.",
              "안내받은 담당자에게 점검을 요청하고 진행 상황을 집주인과 공유하세요.",
              "담당자가 없거나 연락되지 않으면 집주인에게 점검 업체와 일정을 요청하세요.",
            ],
          };
  return buildingGuideSchema.parse({
    version: "building-guide-1",
    repairTitle: repair.title,
    repairExplanation: repair.explanation,
    evidence: repair.evidence,
    contactTitle: contact.title,
    recipient: contact.recipient,
    contactSteps: contact.steps,
    caution:
      "수리 요청 상대와 최종 비용 부담자는 다를 수 있어요. 실제 원인·인과관계·계약·손해 범위를 확인해야 하며, 수리 이력이나 담당자 유무만으로 책임 비율을 정하지 않아요.",
    sources: [
      {
        title: "민법 제623조 · 임대인의 유지 의무",
        url: "https://www.law.go.kr/법령/민법/제623조",
      },
      {
        title: "민법 제634조 · 수리가 필요할 때 임대인에게 알릴 의무",
        url: "https://www.law.go.kr/법령/민법/제634조",
      },
    ],
  });
}
