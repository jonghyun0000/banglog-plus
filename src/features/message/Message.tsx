import { useLanguage } from "../../app/language";
import { localizedRepairMessage } from "../../app/localized-message";
import { englishRecipients } from "../analysis/ResultOverview";
import type { Analysis, Intake } from "../../../shared/schema";
import { SectionTitle, Button } from "../../components/ui/Elements";
import { api } from "../../app/api";
import { DraftEditor } from "./DraftEditor";
import { NextResponse } from "../analysis/NextResponse";
export function Message({
  result,
  input,
  kind,
  onKind,
  text,
  onChange,
  onSave,
  onFeedback,
  onRepair,
}: {
  result: Analysis;
  input: Intake;
  kind: Analysis["messageKind"];
  onKind: (kind: Analysis["messageKind"]) => void;
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onFeedback: () => void;
  onRepair: () => void;
}) {
  const { t, language } = useLanguage();
  const recipient =
    result.repairRequest.recipient === "manager"
      ? "관리 담당자에게"
      : result.repairRequest.recipient === "service"
        ? "제조사·수리업체에"
        : "집주인에게";
  return (
    <div className="message-screen">
      <SectionTitle
        eyebrow={
          result.fallback
            ? t("기본 안내 · 연락 문구")
            : result.mode === "mock"
              ? t("데모: 가상 결과 · 연락 문구")
              : t("연락 문구")
        }
        title={t("수정하고, 복사해서 보내세요")}
      >
        <p>
          {language === "en"
            ? `Send this to your ${englishRecipients[result.repairRequest.recipient]}.`
            : `${recipient} 보낼 문구를 준비했어요.`}
        </p>
      </SectionTitle>
      {language === "en" && (
        <p className="small">
          For a Korean message, switch to 한국어 at the top. Your edits are kept
          separately in each language.
        </p>
      )}
      <div
        className="message-kinds"
        role="group"
        aria-label={t("연락 문구 종류")}
      >
        {(
          [
            ["initial", t("첫 수선 요청")],
            ["cost", t("점검 후 비용 협의")],
            ["followup", t("답변 지연·거절 후 재요청")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className="button secondary"
            type="button"
            aria-pressed={kind === value}
            onClick={() => onKind(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <DraftEditor
        key={`${language}:${kind}`}
        text={text}
        original={localizedRepairMessage(
          input,
          result.repairRequest.recipient,
          kind,
          language,
        )}
        onChange={onChange}
        label={language === "en" ? "Message to copy" : `${recipient} 보낼 문구`}
        onCopied={() => {
          void api.copied(result.analysisId).catch(() => {});
        }}
      />
      <Button secondary onClick={onSave}>
        {t("문구와 결과를 내 기록에 저장")}
      </Button>
      <p className="small save-help">
        {t("로그인 후 동의하면 수정한 문구도 함께 보관해요.")}
      </p>
      <Button secondary onClick={onRepair}>
        {t("수선 기록에 이 문구 가져오기")}
      </Button>
      {language === "ko" && <NextResponse result={result} />}
      <button className="text-button" onClick={onFeedback}>
        {t("도움이 됐는지 알려주기")}
      </button>
    </div>
  );
}
