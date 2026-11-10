import { useId, useRef, useState } from "react";
import { Button } from "../../components/ui/Elements";
import { personalizeMessage } from "./personalize";
import { platform } from "../../platform";

export function DraftEditor({
  text,
  original,
  onChange,
  onCopied,
  label = "보낼 문구",
}: {
  text: string;
  original: string;
  onChange: (text: string) => void;
  onCopied?: () => void;
  label?: string;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const personalized = Boolean(name.trim() || unit.trim());
  const finalText = personalizeMessage(text, name, unit);
  const preview = useRef<HTMLTextAreaElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  function edit(value: string) {
    onChange(value);
    setCopied(false);
    setError("");
    setReset(false);
  }
  async function copy() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    const snapshot = finalText;
    try {
      await platform.copy(snapshot);
      // A slow clipboard response must not mark a newer edit as copied.
      if ((preview.current ?? field.current)?.value === snapshot)
        setCopied(true);
      onCopied?.();
    } catch {
      setCopied(false);
      setError("자동 복사가 되지 않았어요. 전체 선택한 뒤 직접 복사해 주세요.");
      (preview.current ?? field.current)?.focus();
      (preview.current ?? field.current)?.select();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="draft-editor">
      <fieldset>
        <legend>보내는 사람 · 선택</legend>
        <label className="field-label" htmlFor={`${id}-name`}>
          내 이름 (선택)
        </label>
        <input
          type="text"
          id={`${id}-name`}
          value={name}
          maxLength={30}
          autoComplete="off"
          placeholder="예: 김민수"
          onChange={(e) => {
            setName(e.target.value);
            setCopied(false);
          }}
        />
        <label className="field-label" htmlFor={`${id}-unit`}>
          거주지 호수 (선택)
        </label>
        <input
          type="text"
          id={`${id}-unit`}
          value={unit}
          maxLength={30}
          autoComplete="off"
          placeholder="예: 101동 302호"
          onChange={(e) => {
            setUnit(e.target.value);
            setCopied(false);
          }}
        />
        <p className="small">
          비워도 괜찮아요. 이름·호수는 아래 복사할 문구에만 반영하며 AI나 서버에
          보내지 않아요. 화면을 나가면 지워져요.
        </p>
      </fieldset>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <p className="small">
        요청 내용은 여기서 수정하세요. 이름·호수는 위 선택란에 입력하고 본문에는
        개인정보를 적지 마세요.
      </p>
      <textarea
        ref={field}
        id={id}
        className="message-draft"
        value={text}
        maxLength={2000}
        rows={8}
        onChange={(e) => edit(e.target.value)}
      />
      <div className="draft-tools">
        <button
          className="text-button"
          onClick={() => {
            field.current?.focus();
            field.current?.select();
          }}
        >
          전체 선택
        </button>
        <span className="small">{text.length}/2000</span>
      </div>
      <button
        className="text-button"
        disabled={text === original}
        onClick={() => setReset(true)}
      >
        처음 문구로 되돌리기
      </button>
      {reset && (
        <div className="notice">
          <p>수정한 내용을 지우고 처음 문구로 되돌릴까요?</p>
          <button className="text-button" onClick={() => edit(original)}>
            되돌리기 확인
          </button>
          <button className="text-button" onClick={() => setReset(false)}>
            수정 유지
          </button>
        </div>
      )}
      {personalized && (
        <div>
          <label className="field-label" htmlFor={`${id}-preview`}>
            복사할 최종 문구
          </label>
          <textarea
            id={`${id}-preview`}
            ref={preview}
            className="message-draft"
            value={finalText}
            readOnly
            rows={8}
          />
          <p className="small">
            아래 복사 버튼으로 이름·호수가 포함된 문구를 복사해요. 기록에는 위
            요청 본문만 저장해요.
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status" className={copied ? "success" : "small"}>
        {copied
          ? "복사됐어요. 메시지 앱에 붙여넣어 보내주세요."
          : "자동 발송되지 않아요. 복사한 뒤 직접 보내주세요."}
      </p>
      <div className="sticky-actions">
        <Button disabled={busy || !text.trim()} onClick={() => void copy()}>
          {busy ? "복사 중…" : "문구 복사하기"}
        </Button>
      </div>
    </div>
  );
}
