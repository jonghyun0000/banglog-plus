import {
  formatRepairBudget,
  type RepairCostEntry,
  type repairCostCases,
} from "./repair-cost-cases";

function RepairCostList({
  items,
  label,
}: {
  items: RepairCostEntry[];
  label: string;
}) {
  return (
    <ul className="repair-cost-list" role="list" aria-label={label}>
      {items.map((item) => {
        const portfolio = "publishedBudget" in item;
        const sourceName = portfolio ? "숨고" : item.sourceName;
        return (
          <li key={`${item.source}:${item.title}`}>
            <div className="repair-cost-item-heading">
              <strong>{item.title}</strong>
              <strong className="repair-cost-amount">
                {portfolio
                  ? formatRepairBudget(item.publishedBudget)
                  : item.referencePrice}
              </strong>
            </div>
            <p className="small">
              {portfolio
                ? `업체 공개 예산 · ${item.location} · ${item.posted} 게시`
                : item.priceLabel}
            </p>
            <p>{item.work}</p>
            <a
              href={item.source}
              target="_blank"
              rel="noreferrer"
              aria-label={`${item.title} ${sourceName} 원문 보기 (새 탭)`}
            >
              {sourceName} 원문 보기 ↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function RepairCostExamples({
  examples,
}: {
  examples: ReturnType<typeof repairCostCases>;
}) {
  if (examples === null) return null;

  return (
    <section
      className="result-card repair-cost-examples"
      aria-labelledby="repair-cost-title"
    >
      <h2 id="repair-cost-title" tabIndex={-1}>
        비슷한 수리 비용 사례
      </h2>
      <p className="small repair-cost-note">
        공개 예산·참고 견적은 작업 범위에 따라 달라요. 실제 결제액과 누가
        냈는지는 확인되지 않았어요.
      </p>
      {examples.similar.length ? (
        <RepairCostList items={examples.similar} label="비슷한 수리비 자료" />
      ) : (
        <p>
          이 상황과 가까운 자료는 아직 없어요. 점검 후 작업 범위와 견적을 확인해
          보세요.
        </p>
      )}
      {examples.other.length > 0 && (
        <>
          <h3 className="repair-cost-other-heading">
            다른 수리비 자료 <span>{examples.other.length}건</span>
          </h3>
          <RepairCostList items={examples.other} label="다른 수리비 자료" />
        </>
      )}
    </section>
  );
}
