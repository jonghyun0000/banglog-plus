import { observationLabel, repairGuidance } from "../../../shared/questions";
import {
  isLightingIssue,
  lightingRoute,
  usesSingleBulbQuestions,
} from "../../../shared/lighting";
import type { MouseEvent } from "react";
import {
  intakeIssueName,
  type ResponseLanguage,
  type Analysis,
  type Direction,
  type Intake,
} from "../../../shared/schema";
import { english } from "../../app/english";
import { Button } from "../../components/ui/Elements";
import { SafetyNotice } from "../questions/Questions";
import type { CostPreview } from "./repair-cost-cases";

const costOverview: Record<Direction, string> = {
  undetermined: "추가 확인이 필요해요",
  landlord: "집주인 부담 검토",
  tenant: "세입자 부담 검토",
  mixed: "원인별로 나눠 검토",
};

const costChecks: Record<Intake["issue"], string> = {
  mold: "습기가 어디서 생겼는지와 도배 전 점검 결과를 확인해요.",
  leak: "누수 시작 지점과 전용·공용부분 여부를 확인해요.",
  boiler: "고장 원인과 수리·교체 범위를 확인해요.",
  surface: "입주 당시 상태와 부분 보수 가능 여부를 확인해요.",
  drain: "막힌 위치와 배수 점검 결과를 확인해요.",
  fixture: "누가 제공한 제품인지와 고장 원인을 확인해요.",
};

const contactNames = {
  landlord: "집주인",
  manager: "관리 담당자",
  service: "제조사·수리업체",
  emergency: "119",
} as const;

const messageLabels = {
  landlord: "집주인에게 보낼 문구 보기",
  manager: "관리 담당자에게 보낼 문구 보기",
  service: "수리업체에 보낼 문구 보기",
  emergency: "연락 문구 보기",
} as const;

export const englishRecipients = {
  landlord: "landlord",
  manager: "building manager",
  service: "repair provider",
  emergency: "emergency services",
} as const;

export const englishActions: Record<Intake["issue"], string> = {
  mold: "Photograph the affected area and note when it appears. Ask for an inspection of possible moisture sources before repainting.",
  leak: "Keep clear of water near electrical equipment. Record where and when the water appeared, and ask for a prompt inspection.",
  boiler:
    "Record any error code and which function stopped working. Ask for an inspection and keep the findings and itemized quote.",
  surface:
    "Compare the affected area with your move-in records. Ask whether spot repair is possible and why any wider work is needed.",
  drain:
    "Report which drains are affected and what you already tried. Ask for an inspection.",
  fixture:
    "Record the model and the symptoms. Check who provided the item and ask for the inspection findings and repair scope.",
};

const englishMessageLabels = {
  landlord: "View message to your landlord",
  manager: "View message to your building manager",
  service: "View message to the repair provider",
  emergency: "View contact message",
} as const;

function moveToResultSection(event: MouseEvent<HTMLAnchorElement>) {
  const destination = document.getElementById(
    event.currentTarget.hash.slice(1),
  );
  if (!destination) return;
  event.preventDefault();
  destination.focus({ preventScroll: true });
  destination.scrollIntoView({ block: "start" });
}

export function ResultOverview({
  result,
  intake,
  costPreview = null,
  language = "ko",
  onMessage,
  onEdit,
}: {
  result: Analysis;
  intake: Intake;
  costPreview?: CostPreview | null;
  language?: ResponseLanguage;
  onMessage: () => void;
  onEdit?: () => void;
}) {
  const emergency = result.status === "safety_priority";
  const outside = result.status === "out_of_scope";
  const unavailable = result.status === "failed";
  const active = !emergency && !outside && !unavailable;
  const drain = result.drainGuide;
  const recipient = result.repairRequest.recipient;
  const inEnglish = language === "en";
  const t = (text: string) => (inEnglish ? (english[text] ?? text) : text);
  const lighting = isLightingIssue(intake);
  const bulb =
    lighting &&
    lightingRoute(intake) === "bulb" &&
    intake.repairStage !== "after";
  const guidance = repairGuidance(intake);
  const costNote = result.conflictingFacts.length
    ? "원인 설명이 달라요. 각각의 근거와 점검 결과를 대조해요."
    : intake.contract
      ? "입력한 특약이 이번 수리 범위에 해당하는지 확인해요."
      : lighting
        ? "전구 자체 문제인지 등기구 점검이 필요한지 확인해요."
        : costChecks[intake.issue];
  const firstAction = drain
    ? t(drain.steps[0].title)
    : bulb
      ? t(guidance.checks[0])
      : usesSingleBulbQuestions(intake) &&
          (intake.lightingWork?.count ?? 1) === 1 &&
          intake.repairStage !== "after"
        ? t("기존 전구 규격과 입주 당시 조명 상태를 확인하세요.")
        : inEnglish
          ? lighting
            ? t(guidance.record)
            : englishActions[intake.issue]
          : (result.nextActions[0] ?? result.repairRequest.immediateAction);
  const firstNote =
    drain?.route === "stop"
      ? "직접 뚫지 말고 안전한 곳에서 점검을 요청하세요."
      : drain?.route === "self_check"
        ? intake.drain?.attempted === "cleaned"
          ? "그대로라면 분해하지 말고 점검을 요청하세요."
          : "분해 없이 거름망 표면만 확인하세요."
        : drain && intake.drain?.chemical !== "no"
          ? "다른 약품과 섞지 말고 점검 담당자에게 사용 여부를 알려주세요."
          : undefined;
  const contactNote =
    drain?.route === "self_check"
      ? "간단한 확인으로 해결되지 않으면 연락해요."
      : drain?.route === "stop"
        ? "물 사용을 멈춘 뒤 연락해요."
        : intake.repairStage === "after"
          ? "작업 내역을 확인하고 비용을 협의해요."
          : bulb
            ? "전구 교체가 어렵거나 교체 후에도 안 켜지면 문의해요."
            : "증상을 알리고 점검을 요청해요.";
  const links = inEnglish
    ? []
    : [
        { id: "result-steps", title: "자세한 대응" },
        { id: "result-evidence", title: "판단 근거" },
      ];

  return (
    <div className="result-overview">
      <div className="result-heading">
        <p className="result-mode">
          {t(
            result.fallback
              ? "기본 안내 · AI 분석 아님"
              : result.mode === "mock"
                ? "데모: 가상 결과"
                : inEnglish && result.responseLanguage !== "en"
                  ? "입력에 따른 기본 수리 안내"
                  : "AI 보조 안내 · 출처 확인 필요",
          )}
        </p>
        <h1 tabIndex={-1}>
          {emergency
            ? t("먼저 안전을 확인하세요")
            : outside
              ? t("이 문제는 지원 범위 밖이에요")
              : unavailable
                ? t("수리 안내를 불러오지 못했어요")
                : inEnglish
                  ? `${t(intakeIssueName(intake))} repair guide`
                  : `${intakeIssueName(intake)} 수리 가이드`}
        </h1>
        {active && (
          <p className="result-symptom">
            {intake.observation === "unknown" ||
            intake.observation === "light-unknown"
              ? t("증상이 아직 분명하지 않아요.")
              : t(observationLabel(intake))}
          </p>
        )}
      </div>
      {inEnglish && result.fallback && active && (
        <p className="notice">
          {result.fallback.reason.startsWith("KNOWLEDGE_")
            ? "We couldn’t verify enough sources for this situation. Here’s the basic repair guide."
            : "GPT couldn’t complete this request. Here’s the basic repair guide."}
        </p>
      )}
      {emergency && <SafetyNotice />}
      {(outside || unavailable) && (
        <div className="result-card">
          {outside && (
            <p>
              {inEnglish
                ? "This guide covers home repairs in South Korean rentals."
                : result.repairRequest.reason}
            </p>
          )}
          {onEdit && (
            <Button secondary onClick={onEdit}>
              {t("입력 수정하고 다시 확인하기")}
            </Button>
          )}
        </div>
      )}
      {active && (
        <>
          <div
            className="result-summary"
            role="group"
            aria-label={t("핵심 요약")}
          >
            <section
              className="result-first"
              data-urgent={drain?.route === "stop"}
            >
              <h2>{t("지금 할 일")}</h2>
              <p>{firstAction}</p>
              {firstNote && (
                <p className="result-summary-note">{t(firstNote)}</p>
              )}
            </section>
            <section className="result-contact">
              <h2>{t("연락할 곳")}</h2>
              <p>
                {drain?.route === "stop"
                  ? t("집주인·관리 담당자")
                  : inEnglish
                    ? englishRecipients[recipient]
                    : contactNames[recipient]}
              </p>
              <p className="result-summary-note">{t(contactNote)}</p>
            </section>
            <section className="result-cost">
              <h2>{t("비용 부담")}</h2>
              <p>{t(costOverview[result.costResponsibility.direction])}</p>
              <p className="result-summary-note">{t(costNote)}</p>
            </section>
          </div>
          {result.messageDraft && (
            <div className="result-overview-actions">
              <Button onClick={onMessage}>
                {inEnglish
                  ? englishMessageLabels[recipient]
                  : messageLabels[recipient]}
              </Button>
            </div>
          )}
          {costPreview && (
            <a
              className="result-price-preview"
              href="#repair-cost-title"
              onClick={moveToResultSection}
            >
              <span className="result-price-preview-value">
                <span>{costPreview.label}</span>
                {costPreview.amount && <strong>{costPreview.amount}</strong>}
              </span>
              <span className="result-price-preview-link">
                {costPreview.action}
                <span aria-hidden="true"> ›</span>
              </span>
            </a>
          )}
          {links.length > 0 && (
            <div className="result-overview-actions">
              <nav aria-label="수리 결과 바로가기">
                {links.map(({ id, title }) => (
                  <a key={id} href={`#${id}`} onClick={moveToResultSection}>
                    {title}
                  </a>
                ))}
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}
