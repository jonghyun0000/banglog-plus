import { useState } from "react";
import type { Analysis } from "../../../shared/schema";
import { Button, SectionTitle } from "../../components/ui/Elements";
import { platform } from "../../platform";
import { api } from "../../app/api";
export function Message({
  result,
  onFeedback,
}: {
  result: Analysis;
  onFeedback: () => void;
}) {
  const [text, setText] = useState(result.messageDraft);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    setError("");
    try {
      await platform.copy(text);
      setCopied(true);
      void api.copied(result.analysisId).catch(() => {});
    } catch {
      setCopied(false);
      setError(
        "자동 복사가 되지 않았어요. 문구를 길게 누르거나 전체 선택한 뒤 직접 복사해 주세요.",
      );
      document.getElementById("message-draft")?.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow={
          result.mode === "mock" ? "데모: 가상 결과 · 연락 문구" : "연락 문구"
        }
        title="차분하게, 이렇게 물어보세요"
      >
        <p>
          {result.messageKind === "initial"
            ? "처음 점검을 요청하는 문구예요."
            : result.messageKind === "cost"
              ? "비용 기준을 확인하는 문구예요."
              : "이전 요청에 대한 답변을 확인하는 문구예요."}{" "}
          보내기 전에 내 상황에 맞게 수정하세요.
        </p>
      </SectionTitle>
      <label className="field-label" htmlFor="message-draft">
        {result.repairRequest.recipient === "manager"
          ? "관리 담당자에게"
          : "집주인에게"}{" "}
        보낼 문구
      </label>
      <textarea
        className="message-draft"
        id="message-draft"
        value={text}
        maxLength={2000}
        rows={11}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
      />
      <p className="small">연락처를 수집하거나 자동으로 발송하지 않아요.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {copied && (
          <p className="success">
            복사됐어요. 사용하는 메시지 앱에 붙여넣어 보내주세요.
          </p>
        )}
      </div>
      <div className="actions">
        <Button disabled={busy || !text.trim()} onClick={() => void copy()}>
          {busy ? "복사 중…" : "문구 복사하기"}
        </Button>
        <button className="text-button" onClick={onFeedback}>
          도움이 됐는지 알려주기
        </button>
      </div>
    </>
  );
}
