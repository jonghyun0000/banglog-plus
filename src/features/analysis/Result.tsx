import {
  InspectionChecklist,
  type InspectionKey,
} from "../repair/InspectionChecklist";
import { PhotoCoaching, PhotoResult } from "../photos/PhotoResult";
import { BuildingGuide } from "./BuildingGuide";
import { DrainGuide } from "./DrainGuide";
import { NextResponse } from "./NextResponse";
import { ReferenceCards } from "../references/References";
import {
  missingPhotoViews,
  photoClarification,
  type PhotoDevice,
} from "../../../shared/photo";
import type { Analysis, Intake } from "../../../shared/schema";
import { Responsibility } from "./Responsibility";
import { RepairCostExamples } from "./RepairCostExamples";
import { Button } from "../../components/ui/Elements";
import { ResultOverview } from "./ResultOverview";
import { repairCostCases } from "./repair-cost-cases";
import "./result.css";
export function Result({
  result,
  intake,
  onPhotoConfirm,
  onPhotoRetry,
  photoBusy,
  onMessage,
  onEdit,
  onFeedback,
  onSave,
  onRepair,
  onOpenRepair,
  inspectionQuestions,
  onInspectionQuestions,
}: {
  result: Analysis;
  intake: Intake;
  onPhotoConfirm?: (device: PhotoDevice) => void;
  onPhotoRetry?: () => void;
  photoBusy: boolean;
  onMessage: () => void;
  onEdit: () => void;
  onFeedback: () => void;
  onSave: () => void;
  onRepair: () => void;
  onOpenRepair: () => void;
  inspectionQuestions: InspectionKey[];
  onInspectionQuestions: (keys: InspectionKey[]) => void;
}) {
  const issue = intake.issue;
  const supported =
    result.status === "complete" || result.status === "needs_information";
  const clarification =
    supported && photoClarification(intake, result.photoAnalysis);
  const costCases = repairCostCases(intake, result.status);
  const photo = result.photoAnalysis && (
    <PhotoResult
      key={result.analysisId}
      photo={result.photoAnalysis}
      onConfirm={supported ? onPhotoConfirm : undefined}
      onRetry={supported ? onPhotoRetry : undefined}
      busy={photoBusy}
    />
  );
  return (
    <div className="result-screen">
      <ResultOverview
        result={result}
        intake={intake}
        showCosts={costCases !== null}
        onMessage={onMessage}
        onEdit={onEdit}
      />
      {result.fallback && (
        <p className="notice" role="status">
          {result.fallback.notice}
        </p>
      )}
      {!result.fallback &&
        result.mode === "live" &&
        result.sources.some(
          (source) => source.humanLegalReview !== "approved",
        ) && (
          <p className="notice" role="status">
            공식 조문과 입력한 상황을 바탕으로 정리한 일반 안내예요. 개별 사건의
            전문가 판단은 아니며, 비용 부담은 원인·계약·점검 기록을 함께
            확인해야 해요.
          </p>
        )}
      {supported ? (
        <section className="result-detail-grid" aria-labelledby="result-steps">
          <h2 id="result-steps" className="result-group-heading" tabIndex={-1}>
            자세한 대응
          </h2>
          <div className="result-detail-column">
            <DrainGuide result={result} />
            {(!result.drainGuide || result.buildingGuide) && (
              <section className="result-section result-card">
                <h3>상황 전달과 점검 요청</h3>
                <p>{result.repairRequest.reason}</p>
                {!result.drainGuide && (
                  <ol className="next-actions">
                    {result.nextActions.map((action, index) => (
                      <li key={action}>
                        <span aria-hidden="true">{index + 1}</span>
                        <p>{action}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            <BuildingGuide result={result} />
            {result.aiExplanation && !result.fallback && (
              <section className="result-card">
                <h3>GPT가 정리한 안내</h3>
                <p>{result.aiExplanation}</p>
              </section>
            )}
            <details className="result-section result-card">
              <summary>
                {result.tailoredResponse
                  ? "내 상황에 맞는 다음 대응과 근거"
                  : "법률을 참고한 다음 대응"}
              </summary>
              <NextResponse
                result={result}
                showDrain={false}
                showBuilding={false}
              />
            </details>
          </div>
          <div className="result-detail-column">
            <Responsibility result={result} issue={issue} />
            {photo}
            {clarification && (
              <section className="result-card">
                <h3>사진과 함께 확인할 내용</h3>
                <p>{clarification}</p>
              </section>
            )}
            <PhotoCoaching
              issue={issue}
              expanded={result.photoAnalysis?.source === "openai"}
              suggestions={
                result.photoAnalysis?.missingPhotoGuide ??
                (result.photoAnalysis ? undefined : missingPhotoViews(intake))
              }
            />
            <InspectionChecklist
              selected={inspectionQuestions}
              onChange={onInspectionQuestions}
            />
            <details className="result-section result-card">
              <summary>상황별 확인 목록 더 보기</summary>
              <ul>
                {result.additionalChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      ) : (
        photo
      )}
      <RepairCostExamples examples={costCases} />
      <section
        className="result-detail-grid result-footer-grid"
        aria-label="결과 근거와 기록"
      >
        <div className="result-detail-column result-evidence">
          <h2
            id="result-evidence"
            className="result-group-heading"
            tabIndex={-1}
          >
            근거와 입력 내용
          </h2>
          <div className="details-group">
            <details>
              <summary>판단 근거 보기</summary>
              {result.retrieval && (
                <p className="small">
                  등록된 근거 자료에서 이 상황과 관련된 내용을 먼저 찾고, 그
                  자료에 연결된 설명을 사용했어요.
                </p>
              )}
              {result.citedClaims.length ? (
                result.citedClaims.map((c) => {
                  const s = result.sources.find((s) => s.id === c.sourceId);
                  return (
                    <div className="source" key={c.sourceId}>
                      <p>{c.claim}</p>
                      {s && (
                        <>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.title} ↗
                          </a>
                          <p className="small">
                            {s.institution} · {c.location}
                            <br />
                            확인일 {s.checkedAt} · 기술 확인:{" "}
                            {s.technicalStatus === "verified"
                              ? "확인됨"
                              : "대기"}
                            <br />
                            사람의 법률 검토:{" "}
                            {s.reviewBasis === "official_statute"
                              ? "조문 원문 확인 · 개별 사건 검토 전"
                              : s.humanLegalReview === "approved"
                                ? "승인"
                                : "대기"}
                            <br />
                            버전: {s.version}
                          </p>
                          <p className="small">{s.scope}</p>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <p>
                  {result.fallback
                    ? "AI 분석을 완료하지 못한 기본 안내로, 개별 판단에 법률 출처를 연결하지 않았어요."
                    : "이 결과는 질문별 규칙을 보여주는 가상 예시예요. 개별 결론에 법률 출처를 연결하지 않았어요."}
                </p>
              )}
              <p className="small">
                알아야 할 사항: {result.unknownFacts.join(" · ")}
              </p>
            </details>
            <details>
              <summary>입력한 내용 보기</summary>
              {result.userReportedFacts.map((f) => (
                <p className="small" key={f.key}>
                  {f.value}{" "}
                  <span className="fact-label">
                    {f.provenance === "relayed_technician"
                      ? "전해 들은 기사 소견"
                      : f.provenance === "landlord_claim"
                        ? "상대방 주장"
                        : f.provenance === "unknown"
                          ? "미확인"
                          : "사용자 진술"}
                  </span>
                </p>
              ))}
              {supported && (
                <button className="text-button" onClick={onEdit}>
                  입력 수정하고 다시 확인하기
                </button>
              )}
            </details>
          </div>
          {supported && (
            <details className="result-section">
              <summary>관련 판례 원문과 적용 한계</summary>
              <ReferenceCards issue={issue} />
            </details>
          )}
        </div>
        <div className="result-detail-column result-records">
          <h2 className="result-group-heading">기록</h2>
          <div className="result-record-actions">
            {supported && (
              <Button secondary onClick={onRepair}>
                이 상황을 수선 기록으로 이어가기
              </Button>
            )}
            <Button secondary onClick={onSave}>
              내 기록에 저장
            </Button>
            <button className="text-button" onClick={onOpenRepair}>
              수선 요청·퇴실 기록장
            </button>
          </div>
          <p className="small">
            로그인 후 저장하면 나중에도 다시 볼 수 있어요.
          </p>
        </div>
      </section>
      <div className="cautions">
        {result.cautions.map((c) => (
          <p className="small" key={c}>
            {c}
          </p>
        ))}
      </div>
      <p className="small">
        문제가 있으면 의견을 남겨주세요. 안내가 이상해도 실제 수리나 비용 지급을
        시험할 필요는 없어요.
      </p>
      <button className="text-button" onClick={onFeedback}>
        가이드에 대한 의견 남기기
      </button>
    </div>
  );
}
