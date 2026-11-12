import type { Analysis, Intake } from "../../../shared/schema";
import { repairCostCases } from "./repair-cost-cases";

const krw = new Intl.NumberFormat("ko-KR");

export function RepairCostExamples({
  input,
  status,
}: {
  input: Intake;
  status: Analysis["status"];
}) {
  const examples = repairCostCases(input, status);
  if (examples === null) return null;

  return (
    <section
      className="result-card repair-cost-examples"
      aria-labelledby="repair-cost-title"
    >
      <h2 id="repair-cost-title">비슷한 수리 비용 사례</h2>
      {examples.length ? (
        <>
          <ul className="repair-cost-list">
            {examples.map(
              ({ title, work, publishedBudget, location, posted, source }) => (
                <li key={source}>
                  <h3>{title}</h3>
                  <p className="repair-cost-amount">
                    <span>업체 공개 예산</span>
                    <strong>{krw.format(publishedBudget)}원</strong>
                  </p>
                  <p>{work}</p>
                  <p className="small">
                    {location} · {posted} 게시
                  </p>
                  <a
                    href={source}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${title} 숨고 원문 보기 (새 탭)`}
                  >
                    숨고 원문 보기 ↗
                  </a>
                </li>
              ),
            )}
          </ul>
          <p className="small">
            실제 결제액과 누가 냈는지는 확인되지 않았어요. 내 견적은 작업 범위와
            현장 상태에 따라 달라질 수 있어요.
          </p>
        </>
      ) : (
        <p>
          이 상황과 비교할 만한 공개 비용 사례를 아직 찾지 못했어요. 점검 후
          출장비·작업비·자재비를 나눠서 견적을 받아보세요.
        </p>
      )}
    </section>
  );
}
