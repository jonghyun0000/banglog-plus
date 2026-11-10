import { useEffect, useState } from "react";
import type { ConnectionStatus } from "../../../shared/admin";
export function Status({
  expanded = false,
  compact = false,
}: {
  expanded?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(expanded),
    [value, setValue] = useState<ConnectionStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) throw Error();
      setValue(await r.json());
    } catch {
      setError("서버 상태를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (open) void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <section
      className={`connection-panel ${compact ? "connection-compact" : ""}`}
    >
      <button
        className="text-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        연결 상태 {open ? "접기" : "확인"}
      </button>
      {open && (
        <div className="connection-body">
          <p className="small">
            설정 여부와 실제 응답 기록을 구분해 보여드려요.
          </p>
          {error && <p role="alert">{error}</p>}
          {value && (
            <>
              <dl className="status-list">
                <div>
                  <dt>서비스</dt>
                  <dd>v{value.version}</dd>
                </div>
                <div>
                  <dt>백엔드 API</dt>
                  <dd>
                    {value.api === "connected" ? "연결됨" : "연결 확인 필요"}
                  </dd>
                </div>
                <div>
                  <dt>데이터베이스</dt>
                  <dd>
                    {value.database === "connected"
                      ? "연결됨"
                      : "연결 확인 필요"}
                  </dd>
                </div>
                <div>
                  <dt>검색 근거</dt>
                  <dd>{value.knowledge.count}개 문단</dd>
                </div>
                <div>
                  <dt>GPT</dt>
                  <dd>
                    {value.ai.mode === "mock"
                      ? "데모 모드"
                      : value.ai.configured
                        ? "연결 설정됨"
                        : "설정 필요"}
                  </dd>
                </div>
                <div>
                  <dt>최근 GPT 성공</dt>
                  <dd>
                    {value.ai.lastSuccess
                      ? new Date(value.ai.lastSuccess).toLocaleString("ko-KR")
                      : "아직 확인 기록 없음"}
                  </dd>
                </div>
              </dl>
              {value.ai.lastFailure &&
                (!value.ai.lastSuccess ||
                  value.ai.lastFailure > value.ai.lastSuccess) && (
                  <p className="notice">
                    최근 AI 연결 또는 응답 검증에 실패한 기록이 있어요. 기본
                    안내로 전환될 수 있어요.
                  </p>
                )}
              <p className="small">
                {value.ai.model ?? "모델 미설정"} ·{" "}
                {new Date(value.checkedAt).toLocaleTimeString("ko-KR")} 확인
              </p>
            </>
          )}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void refresh()}
          >
            {busy ? "확인 중…" : "상태 새로고침"}
          </button>
        </div>
      )}
    </section>
  );
}
