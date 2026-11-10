import type { Analysis } from "../../../shared/schema";
export function BuildingGuide({ result }: { result: Analysis }) {
  const guide = result.buildingGuide;
  if (!guide || ["safety_priority", "out_of_scope"].includes(result.status))
    return null;
  return (
    <section
      className="result-card next-response building-guide"
      aria-label="수리 이력과 연락 순서"
    >
      <p className="eyebrow">선택한 답변에 따른 고정 안내 · AI 생성 아님</p>
      <h2>{guide.repairTitle}</h2>
      <p>{guide.repairExplanation}</p>
      <details>
        <summary>책임 판단을 위해 준비할 자료</summary>
        <ul>
          {guide.evidence.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </details>
      <h3>{guide.contactTitle}</h3>
      <ol className="response-steps">
        {guide.contactSteps.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <p className="notice">{guide.caution}</p>
      <details>
        <summary>고정 안내의 법률 근거</summary>
        <p className="small">
          유지 의무와 통지 의무의 일반 원칙입니다. 자료 준비와 연락 순서는 이를
          참고해 정한 방로그의 안내이며, 개별 사건의 배상책임을 판정한 내용은
          아니에요.
        </p>
        {guide.sources.map((source) => (
          <p key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title} ↗
            </a>
          </p>
        ))}
      </details>
    </section>
  );
}
