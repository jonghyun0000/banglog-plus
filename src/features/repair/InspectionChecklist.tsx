import { useId, useRef, useState } from "react";
import { platform } from "../../platform";

const inspectionItems = [
  ["cause", "어떤 원인을 확인했고, 어떤 방법으로 점검하셨나요?"],
  ["unknown", "확인된 부분과 추가 점검이 필요한 부분을 알려주실 수 있나요?"],
  [
    "scope",
    "부분 수리가 가능한가요? 전체 교체가 필요하다면 이유는 무엇인가요?",
  ],
  ["cost", "출장비·진단비·부품비·공임을 구분한 금액을 받을 수 있나요?"],
  ["documents", "견적서·영수증·점검 소견 중 받을 수 있는 자료가 있나요?"],
] as const;

export type InspectionKey = (typeof inspectionItems)[number][0];

export function InspectionChecklist({
  selected,
  onChange,
}: {
  selected: InspectionKey[];
  onChange: (keys: InspectionKey[]) => void;
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState(false);
  const copyField = useRef<HTMLTextAreaElement>(null);
  const questions = inspectionItems
    .filter(([key]) => !selected.length || selected.includes(key))
    .map(([, question]) => question)
    .join("\n");
  async function copy() {
    try {
      await platform.copy(questions);
      setStatus("점검 질문을 복사했어요.");
      setManual(false);
    } catch {
      setStatus("아래 질문을 선택해 직접 복사해 주세요.");
      setManual(true);
    }
  }
  return (
    <details className="result-card inspection-checklist">
      <summary>기사에게 물어볼 점검 질문</summary>
      <p className="small">
        물어볼 질문을 골라 복사하세요. 선택하지 않으면 전체를 복사해요.
      </p>
      <fieldset>
        <legend>물어볼 질문</legend>
        {inspectionItems.map(([key, question]) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selected, key]
                    : selected.filter((k) => k !== key),
                );
                setStatus("");
              }}
            />
            <span>{question}</span>
          </label>
        ))}
      </fieldset>
      <button className="text-button" onClick={() => void copy()}>
        점검 질문 복사
      </button>
      {status && <p role="status">{status}</p>}
      {manual && (
        <>
          <label htmlFor={id}>복사할 점검 질문</label>
          <textarea
            id={id}
            ref={copyField}
            value={questions}
            readOnly
            onFocus={() => copyField.current?.select()}
          />
        </>
      )}
    </details>
  );
}
