import { useState } from "react";
import type { Feedback as FeedbackData } from "../../../shared/schema";
import { api } from "../../app/api";
import { Button, Choice, SectionTitle } from "../../components/ui/Elements";
export function Feedback({
  id,
  onDone,
  localOnly = false,
}: {
  id: string;
  onDone: () => void;
  localOnly?: boolean;
}) {
  const [data, setData] = useState<FeedbackData>({
    helpful: "unsure",
    understood: "unsure",
    errorType: "none",
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api.feedback(id, data);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "의견을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <>
        <SectionTitle eyebrow="피드백 완료" title="의견을 남겨주셔서 감사해요">
          <p>
            {localOnly
              ? "체험용 의견을 브라우저에 임시 보관했어요. 운영자에게는 전달되지 않아요."
              : "더 이해하기 쉬운 가이드를 만드는 데 참고할게요."}
          </p>
        </SectionTitle>
        <Button onClick={onDone}>결과로 돌아가기</Button>
      </>
    );
  return (
    <>
      <SectionTitle
        eyebrow="선택 피드백"
        title="다음 행동이 조금 더 명확해졌나요?"
      >
        <p>
          {localOnly
            ? "피드백 입력을 체험할 수 있어요. 의견은 운영자에게 전달되지 않아요."
            : "답하지 않아도 모든 기능을 이용할 수 있어요. 원문은 별도 연구에 사용하지 않아요."}
        </p>
      </SectionTitle>
      {(["helpful", "understood"] as const).map((key, i) => (
        <fieldset key={key}>
          <legend>
            {i === 0 ? "안내가 도움이 됐나요?" : "무엇을 해야 할지 이해했나요?"}
          </legend>
          <div className="choices">
            {(
              [
                ["yes", "네"],
                ["no", "아니요"],
                ["unsure", "잘 모르겠어요"],
              ] as const
            ).map(([v, l]) => (
              <Choice
                key={v}
                value={v}
                current={data[key]}
                label={l}
                onChange={(v) => setData({ ...data, [key]: v })}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <label className="field-label" htmlFor="error-type">
        잘못된 내용이 있었나요?
      </label>
      <select
        id="error-type"
        value={data.errorType}
        onChange={(e) =>
          setData({
            ...data,
            errorType: e.target.value as FeedbackData["errorType"],
          })
        }
      >
        {[
          ["none", "없어요"],
          ["fact", "입력 사실이 다르게 반영됐어요"],
          ["source", "근거·출처가 이상해요"],
          ["responsibility", "비용 부담 안내가 이상해요"],
          ["wording", "표현이 어렵거나 부적절해요"],
          ["other", "그 외 오류가 있어요"],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <details className="result-section">
        <summary>화면 문제를 따로 전달하고 싶어요</summary>
        <p className="small">
          어느 화면에서 무엇을 눌렀고, 예상과 달리 무엇이 나왔는지 알려주세요.
          캡처에는 이름·주소·연락처가 나오지 않게 가려주세요.
        </p>
        <p className="small">
          결과 번호: <code style={{ overflowWrap: "anywhere" }}>{id}</code>
        </p>
        <p className="small">
          이 번호는 결과를 찾는 용도이며 로그인 비밀번호나 접근 권한이 아니에요.
        </p>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? "저장 중…" : "의견 남기기"}
        </Button>
        <button className="text-button" onClick={onDone}>
          건너뛰기
        </button>
      </div>
    </>
  );
}
