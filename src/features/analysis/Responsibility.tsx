import { sourceLink } from "../../../shared/source-link";
import type { Analysis, Issue } from "../../../shared/schema";

const evidence: Record<Issue, string> = {
  drain: "막힌 위치·범위와 배수구 상태, 이미 해본 조치",
  mold: "곰팡이 위치·재발 시점, 누수·단열 점검과 환기 기록",
  leak: "누수 위치·시점과 전용·공용배관의 점검 결과",
  boiler: "조절기 오류 코드, 제조연월과 교체·점검 이력",
  surface: "입주·퇴실 상태와 부분 보수 또는 전체 교체 견적",
  fixture: "계약의 옵션 목록, 제품 제공 주체와 부품 점검 결과",
};

export function Responsibility({
  result,
  issue,
}: {
  result: Analysis;
  issue: Issue;
}) {
  if (result.status === "safety_priority" || result.status === "out_of_scope")
    return null;
  const direction = result.costResponsibility.direction;
  const recipient =
    result.repairRequest.recipient === "manager"
      ? "관리 담당자에게"
      : result.repairRequest.recipient === "service"
        ? "제조사·수리업체에"
        : "집주인에게";
  const cards = [
    {
      key: "landlord",
      title: "시설 노후·결함이 확인되면",
      direction: "주택에 제공된 시설이라면 집주인의 수선 범위를 검토해요.",
      check: `${evidence[issue]}, 설치·제공 주체, 특약`,
      action: `${recipient} 원인 점검과 필요한 수리 범위를 요청하세요.`,
      ids: ["civil-623"],
    },
    {
      key: "tenant",
      title: "사용 중 손상과의 관련성이 확인되면",
      direction:
        "손상 원인과 필요한 복구 범위를 바탕으로 세입자 부담 가능성을 살펴봐요.",
      check: `${evidence[issue]}, 기존 하자, 손상과 사용의 관계`,
      action: `${recipient} 부분 보수 가능 여부와 항목별 견적을 요청하세요.`,
      ids: ["civil-615", "civil-654"],
    },
    {
      key: "mixed",
      title: "외부 원인이 의심되거나 원인을 모르면",
      direction: "원인 위치와 수리 담당을 확인한 뒤 비용 협의에 들어가요.",
      check: `${evidence[issue]}, 원인이 밝혀지지 않은 부분`,
      action:
        "공용부분·다른 세대가 의심되면 관리 담당자에게, 그 외에는 수리 요청 대상에게 점검 내용을 확인하세요.",
      ids: ["civil-623", "civil-634"],
    },
  ];
  const preferred = direction === "undetermined" ? "mixed" : direction;
  const ordered = [
    ...cards.filter((c) => c.key === preferred),
    ...cards.filter((c) => c.key !== preferred),
  ];
  return (
    <section
      className="result-section result-card responsibility"
      aria-labelledby="responsibility-title"
    >
      <h2 id="responsibility-title">점검 결과에 따라 이렇게 대응해요</h2>
      {result.costResponsibility.conditions.map((condition) => (
        <p key={condition}>{condition}</p>
      ))}
      {result.conflictingFacts.map((fact) => (
        <p className="notice" key={fact}>
          {fact}
        </p>
      ))}
      <div className="condition-cards">
        {ordered.map((card) => {
          const sources =
            result.mode === "live" && !result.fallback
              ? result.sources.filter((s) => card.ids.includes(s.id))
              : [];
          return (
            <details key={card.key} open={card.key === preferred}>
              <summary>{card.title}</summary>
              <p>{card.direction}</p>
              <p>
                <strong>확인할 자료</strong> · {card.check}
              </p>
              <p>
                <strong>지금 할 일</strong> · {card.action}
              </p>
              {sources.length > 0 ? (
                <ul>
                  {sources.map((source) => (
                    <li key={source.id}>
                      <a
                        href={sourceLink(source.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.title} ↗
                      </a>
                      <p className="small">{source.scope}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">
                  이 조건에 연결된 검증 인용이 없어요. 비용 판단은 점검과 계약
                  확인 후에 하세요.
                </p>
              )}
            </details>
          );
        })}
      </div>
      <p className="small">{result.costResponsibility.uncertainty}</p>
    </section>
  );
}
