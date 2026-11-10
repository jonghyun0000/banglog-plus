import type { Analysis } from "../../../shared/schema";
export function DrainGuide({ result }: { result: Analysis }) {
  const guide = result.drainGuide;
  if (!guide || ["safety_priority", "out_of_scope"].includes(result.status))
    return null;
  return (
    <section className="next-response drain-guide result-card">
      <p className="eyebrow">먼저 할 일 · 선택한 답변에 따른 안전 안내</p>
      <h2>{guide.title}</h2>
      <ol className="response-steps">
        {guide.steps.map((s) => (
          <li key={s.title}>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="notice">{guide.warning}</p>
      <details>
        <summary>생활 조치 안내의 출처</summary>
        <p className="small">
          아래 한국어 자료는 이물질에 의한 막힘과 세정제 혼합 주의의 참고
          근거예요. 분해·약품·도구 사용을 제한하는 단계는 방로그의 보수적인 안전
          기준이며, 원문 전체를 그대로 적용한 지침은 아니에요. 실제 제품·시설
          설명서를 우선 확인하세요.
        </p>
        {guide.sources.map((s) => (
          <p key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title} ↗
            </a>
          </p>
        ))}
      </details>
    </section>
  );
}
