import { useEffect, useState } from "react";
import { useLanguage } from "../../app/language";

export function AnalysisProgress() {
  const { language } = useLanguage();
  const [startedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return (
    <div className="analysis-progress">
      <span className="loading-ring" aria-hidden="true" />
      <p className="small" role="timer" aria-live="off">
        {language === "en"
          ? `Analysis in progress · ${seconds}s elapsed`
          : `분석 진행 중 · ${seconds}초 경과`}
      </p>
      {seconds >= 30 && (
        <p className="small" role="status">
          {language === "en"
            ? "This is taking a little longer. You can wait or cancel below."
            : "평소보다 시간이 걸리고 있어요. 기다리거나 아래에서 취소할 수 있어요."}
        </p>
      )}
    </div>
  );
}
