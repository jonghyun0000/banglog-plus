import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HistoryEntry } from "../../../shared/account";
import { useLanguage } from "../../app/language";
import { Result } from "../analysis/Result";
import { EnglishGuide } from "../analysis/EnglishGuide";
import type { InspectionKey } from "../repair/InspectionChecklist";

const noAction = () => {};

/** Render the stored snapshot; opening history never re-runs GPT or updates a record. */
export function SavedResult({
  entry,
  onBack,
  children,
}: {
  entry: HistoryEntry;
  onBack: () => void;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const [inspection, setInspection] = useState<InspectionKey[]>([]);
  const [messageOpen, setMessageOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const message = useRef<HTMLElement>(null);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (messageOpen) {
      message.current?.scrollIntoView({ block: "start" });
      message.current?.focus({ preventScroll: true });
    }
  }, [messageOpen]);
  const openMessage = () => {
    setMessageOpen(true);
    message.current?.scrollIntoView({ block: "start" });
  };
  const result = (
    <Result
      result={entry.result}
      intake={entry.input}
      readOnly
      showOverview={language === "ko"}
      photoBusy={false}
      onMessage={openMessage}
      onEdit={noAction}
      onSave={noAction}
      onRepair={noAction}
      onOpenRepair={noAction}
      onFeedback={noAction}
      inspectionQuestions={inspection}
      onInspectionQuestions={setInspection}
    />
  );
  return (
    <div className="saved-result-view">
      <button className="text-button" onClick={onBack}>
        {language === "en" ? "← Back to My records" : "← 내 기록 목록"}
      </button>
      <h2 ref={heading} tabIndex={-1}>
        {language === "en" ? "Saved result" : "저장한 최종 결과"}
      </h2>
      <p className="small">
        {language === "en" ? "Saved on " : "저장일 "}
        <time dateTime={entry.createdAt}>
          {new Intl.DateTimeFormat("sv-SE").format(new Date(entry.createdAt))}
        </time>
        {language === "en"
          ? " · Original saved answer. No new AI analysis."
          : " · 저장 당시 답변이에요. AI 분석을 다시 요청하지 않아요."}
      </p>
      {language === "en" ? (
        <>
          <EnglishGuide
            result={entry.result}
            intake={entry.input}
            readOnly
            onMessage={openMessage}
            onEdit={noAction}
            onSave={noAction}
            onRepair={noAction}
          />
          <details>
            <summary>More details in Korean</summary>
            <div lang="ko">{result}</div>
          </details>
        </>
      ) : (
        result
      )}
      <section
        ref={message}
        tabIndex={-1}
        className="result-card saved-result-message"
        hidden={!messageOpen}
      >
        <h2>
          {language === "en" ? "Saved contact message" : "저장한 연락 문구"}
        </h2>
        {children}
        <button className="text-button" onClick={() => setMessageOpen(false)}>
          {language === "en" ? "Close message" : "문구 접기"}
        </button>
      </section>
      <button className="text-button" onClick={onBack}>
        {language === "en" ? "Back to My records" : "내 기록 목록으로"}
      </button>
    </div>
  );
}
