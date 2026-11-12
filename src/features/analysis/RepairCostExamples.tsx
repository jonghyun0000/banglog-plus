import { useRef } from "react";
import { formatRepairBudget, type RepairCostEntry } from "./repair-cost-cases";

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
          <li key={`${item.source}:${item.title}`} className="repair-cost-item">
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
  examples: RepairCostEntry[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  if (!examples.length) return null;
  const additional = examples.slice(3);

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
      <RepairCostList items={examples.slice(0, 3)} label="비슷한 수리비 자료" />
      {additional.length > 0 && (
        <>
          <button
            ref={more}
            className="text-button repair-cost-more"
            aria-haspopup="dialog"
            onClick={() => dialog.current?.showModal()}
          >
            관련 견적·사례 더 보기 ({additional.length}건)
          </button>
          <dialog
            ref={dialog}
            onClose={() => more.current?.focus({ preventScroll: true })}
            className="repair-cost-dialog"
            aria-labelledby="repair-cost-dialog-title"
          >
            <div className="repair-cost-dialog-heading">
              <h2 id="repair-cost-dialog-title">추가 수리비 자료</h2>
              <form method="dialog">
                <button className="text-button">닫기</button>
              </form>
            </div>
            <RepairCostList items={additional} label="추가 관련 견적과 사례" />
          </dialog>
        </>
      )}
    </section>
  );
}
