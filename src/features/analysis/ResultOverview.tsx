import { observationLabel } from "../../../shared/questions";
import { isLightingIssue, lightingRoute } from "../../../shared/lighting";
import type { MouseEvent } from "react";
import {
  intakeIssueName,
  type Analysis,
  type Direction,
  type Intake,
} from "../../../shared/schema";
import { Button } from "../../components/ui/Elements";
import { SafetyNotice } from "../questions/Questions";
import type { CostPreview } from "./repair-cost-cases";

const costOverview: Record<Direction, [string, string]> = {
  undetermined: ["점검 후 협의", "원인과 계약 확인이 필요해요."],
  landlord: ["집주인 부담 검토", "시설 상태와 수리 약정을 확인해요."],
  tenant: ["세입자 부담 검토", "손상 원인과 복구 범위를 확인해요."],
  mixed: ["원인별로 나눠 검토", "시설 문제와 사용 요인을 확인해요."],
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
  costPreview,
  onMessage,
  onEdit,
}: {
  result: Analysis;
  intake: Intake;
  costPreview: CostPreview | null;
  onMessage: () => void;
  onEdit: () => void;
}) {
  const emergency = result.status === "safety_priority";
  const outside = result.status === "out_of_scope";
  const unavailable = result.status === "failed";
  const active = !emergency && !outside && !unavailable;
  const drain = result.drainGuide;
  const recipient = result.repairRequest.recipient;
  const [cost, costNote] = costOverview[result.costResponsibility.direction];
  const firstAction =
    drain?.steps[0]?.title ??
    result.nextActions[0] ??
    result.repairRequest.immediateAction;
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
          : isLightingIssue(intake) && lightingRoute(intake) === "bulb"
            ? "전구 교체가 어렵거나 교체 후에도 안 켜지면 문의해요."
            : "증상을 알리고 점검을 요청해요.";
  const links = [
    { id: "result-steps", title: "자세한 대응" },
    { id: "result-evidence", title: "판단 근거" },
  ];

  return (
    <div className="result-overview">
      <div className="result-heading">
        <p className="result-mode">
          {result.fallback
            ? "기본 안내 · AI 분석 아님"
            : result.mode === "mock"
              ? "데모: 가상 결과"
              : "AI 보조 안내 · 출처 확인 필요"}
        </p>
        <h1 tabIndex={-1}>
          {emergency
            ? "먼저 안전을 확인하세요"
            : outside
              ? "이 문제는 지원 범위 밖이에요"
              : unavailable
                ? "수리 안내를 불러오지 못했어요"
                : `${intakeIssueName(intake)} 수리 가이드`}
        </h1>
        {active && (
          <p className="result-symptom">
            {intake.observation === "unknown" ||
            intake.observation === "light-unknown"
              ? "증상이 아직 분명하지 않아요."
              : observationLabel(intake)}
          </p>
        )}
      </div>
      {emergency && <SafetyNotice />}
      {(outside || unavailable) && (
        <div className="result-card">
          {outside && <p>{result.repairRequest.reason}</p>}
          <Button secondary onClick={onEdit}>
            입력 수정하고 다시 확인하기
          </Button>
        </div>
      )}
      {active && (
        <>
          <div className="result-summary" role="group" aria-label="핵심 요약">
            <section
              className="result-first"
              data-urgent={drain?.route === "stop"}
            >
              <h2>지금 할 일</h2>
              <p>{firstAction}</p>
              {firstNote && <p className="result-summary-note">{firstNote}</p>}
            </section>
            <section className="result-contact">
              <h2>연락할 곳</h2>
              <p>
                {drain?.route === "stop"
                  ? "집주인·관리 담당자"
                  : contactNames[recipient]}
              </p>
              <p className="result-summary-note">{contactNote}</p>
            </section>
            <section className="result-cost">
              <h2>비용 부담</h2>
              <p>{cost}</p>
              <p className="result-summary-note">{costNote}</p>
            </section>
          </div>
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
          <div className="result-overview-actions">
            {result.messageDraft && (
              <Button onClick={onMessage}>{messageLabels[recipient]}</Button>
            )}
            <nav aria-label="수리 결과 바로가기">
              {links.map(({ id, title }) => (
                <a key={id} href={`#${id}`} onClick={moveToResultSection}>
                  {title}
                </a>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
