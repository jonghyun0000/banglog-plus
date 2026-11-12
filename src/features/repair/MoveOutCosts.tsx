import { useState } from "react";
import { repairScopeLabels, repairScopeSchema } from "../../../shared/schema";
import {
  moveOutCostEntries,
  moveOutCostLabels,
  moveOutMessage,
  type MoveOutCostKind,
  type RepairRecord,
} from "../../../shared/repair";
import { DraftEditor } from "../message/DraftEditor";

export function MoveOutCosts({
  record,
  onChange,
}: {
  record: RepairRecord;
  onChange: (patch: Partial<RepairRecord>) => void;
}) {
  const entries = moveOutCostEntries(record);
  return (
    <section className="move-out-costs">
      <h3>퇴실 비용 항목별 기록</h3>
      <p className="small">
        공제를 요청받은 항목만 입력하세요. 실제 낸 비용은 아래 지출란에 따로
        적을 수 있어요.
      </p>
      {(Object.entries(moveOutCostLabels) as [MoveOutCostKind, string][]).map(
        ([kind, label]) => {
          const cost = record.moveOutCosts[kind] ?? { amount: "", reason: "" };
          const entry = entries.find((item) => item.kind === kind);
          function update(
            patch: Partial<
              NonNullable<RepairRecord["moveOutCosts"][MoveOutCostKind]>
            >,
          ) {
            onChange({
              moveOutCosts: {
                ...record.moveOutCosts,
                [kind]: { ...cost, ...patch },
              },
            });
          }
          return (
            <details key={kind}>
              <summary>
                {label}
                {entry && <span>{entry.amount || "기록됨"}</span>}
              </summary>
              <label>
                {label} 공제 요청액 (원)
                <input
                  inputMode="numeric"
                  maxLength={40}
                  value={cost.amount}
                  onChange={(e) => update({ amount: e.target.value })}
                />
              </label>
              <label>
                {label} 공제 사유
                <textarea
                  maxLength={300}
                  value={cost.reason}
                  onChange={(e) => update({ reason: e.target.value })}
                />
              </label>
              {kind !== "cleaning" && (
                <>
                  <label>
                    {label} 문제 위치 (선택)
                    <input
                      maxLength={120}
                      value={cost.location ?? ""}
                      onChange={(e) => update({ location: e.target.value })}
                    />
                  </label>
                  <label>
                    {label} 청구 작업 범위 (선택)
                    <select
                      value={cost.scope ?? ""}
                      onChange={(e) =>
                        update({
                          scope: repairScopeSchema.safeParse(e.target.value)
                            .data,
                        })
                      }
                    >
                      <option value="">선택 안 함</option>
                      {repairScopeSchema.options.map((scope) => (
                        <option key={scope} value={scope}>
                          {repairScopeLabels[scope]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </details>
          );
        },
      )}
      <label>
        공제 대상 작업 진행 상태 (선택)
        <select
          value={record.repairStage ?? ""}
          onChange={(e) =>
            onChange({
              repairStage:
                e.target.value === "before" || e.target.value === "after"
                  ? e.target.value
                  : undefined,
            })
          }
        >
          <option value="">아직 모름</option>
          <option value="before">작업 전 · 견적 확인</option>
          <option value="after">작업 후 · 실제 내역 확인</option>
        </select>
      </label>
    </section>
  );
}

export function MoveOutDraft({ record }: { record: RepairRecord }) {
  const [open, setOpen] = useState(false);
  const original = moveOutMessage(record);
  const [draft, setDraft] = useState({ original, text: original });
  return (
    <details
      className="move-out-draft"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>집주인에게 보낼 퇴실 비용 문구</summary>
      {open && (
        <DraftEditor
          key={original}
          original={original}
          text={draft.original === original ? draft.text : original}
          onChange={(text) => setDraft({ original, text })}
          label="보낼 퇴실 비용 문구"
        />
      )}
    </details>
  );
}
