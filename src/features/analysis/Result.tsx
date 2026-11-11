import {
  InspectionChecklist,
  type InspectionKey,
} from "../repair/InspectionChecklist";
import { PhotoCoaching, PhotoResult } from "../photos/PhotoResult";
import { BuildingGuide } from "./BuildingGuide";
import { DrainGuide } from "./DrainGuide";
import { NextResponse } from "./NextResponse";
import { ReferenceCards } from "../references/References";
import type { Analysis, Issue } from "../../../shared/schema";
import { Responsibility } from "./Responsibility";
import { Button, SectionTitle } from "../../components/ui/Elements";
import { SafetyNotice } from "../questions/Questions";
export function Result({
  result,
  issue,
  onMessage,
  onEdit,
  onFeedback,
  onSave,
  onRepair,
  inspectionQuestions,
  onInspectionQuestions,
}: {
  result: Analysis;
  issue: Issue;
  onMessage: () => void;
  onEdit: () => void;
  onFeedback: () => void;
  onSave: () => void;
  onRepair: () => void;
  inspectionQuestions: InspectionKey[];
  onInspectionQuestions: (keys: InspectionKey[]) => void;
}) {
  const emergency = result.status === "safety_priority",
    outside = result.status === "out_of_scope";
  return (
    <div className="result-screen">
      <SectionTitle
        eyebrow={
          result.fallback
            ? "기본 안내 · AI 분석 아님"
            : result.mode === "mock"
              ? "데모: 가상 결과"
              : "AI 보조 안내 · 출처 확인 필요"
        }
        title={
          emergency
            ? "먼저 안전을 확인하세요"
            : outside
              ? "이 문제는 지원 범위 밖이에요"
              : "지금은 이렇게 시작해요"
        }
      >
        <p>
          {emergency
            ? "비용보다 안전이 우선이에요."
            : outside
              ? "주택의 수리 문제를 선택해 주세요."
              : "수리 요청과 비용 부담은 따로 살펴봐요."}
        </p>
      </SectionTitle>
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
      {emergency && <SafetyNotice />}
      <DrainGuide result={result} />
      <section className="result-lead">
        <p className="eyebrow">
          {result.drainGuide
            ? "점검이 필요할 때 연락할 곳"
            : "01 · 누구에게 먼저 요청할까요?"}
        </p>
        <h2>
          {emergency
            ? "안전한 곳에서 119에"
            : outside
              ? "지원 범위를 다시 확인해요"
              : result.repairRequest.recipient === "manager"
                ? "관리 담당자에게 먼저"
                : result.repairRequest.recipient === "service"
                  ? "제조사·수리업체에 문의해요"
                  : "집주인에게 점검을 요청해요"}
        </h2>
        <p>{result.repairRequest.reason}</p>
      </section>
      <BuildingGuide result={result} />
      {result.aiExplanation && !result.fallback && (
        <section className="result-card">
          <p className="eyebrow">GPT가 정리한 안내</p>
          <p>{result.aiExplanation}</p>
        </section>
      )}
      {!result.drainGuide && (
        <section className="result-section result-card">
          <p className="eyebrow">03 · 지금 무엇을 확인할까요?</p>
          <ol className="next-actions">
            {result.nextActions.map((a, i) => (
              <li key={a}>
                <span aria-hidden="true">{i + 1}</span>
                <p>{a}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Responsibility result={result} issue={issue} />
      {result.messageDraft && (
        <div className="result-action">
          <Button onClick={onMessage}>
            {result.repairRequest.recipient === "manager"
              ? "관리 담당자에게 보낼 문구 보기"
              : result.repairRequest.recipient === "service"
                ? "수리업체에 보낼 문구 보기"
                : "집주인에게 보낼 문구 보기"}
          </Button>
          <p className="small">
            문구를 확인·수정하고 직접 전달하세요. 자동 발송되지 않아요.
          </p>
        </div>
      )}
      {!emergency && !outside && (
        <>
          <Button secondary onClick={onRepair}>
            이 상황을 수선 기록으로 이어가기
          </Button>
          <InspectionChecklist
            selected={inspectionQuestions}
            onChange={onInspectionQuestions}
          />
          <PhotoResult photo={result.photoAnalysis} />
          <PhotoCoaching issue={issue} />
        </>
      )}
      <button className="button secondary result-save" onClick={onSave}>
        내 기록에 저장
      </button>
      <p className="small save-help">
        로그인 후 저장하면 나중에도 다시 볼 수 있어요.
      </p>
      {!emergency && !outside && (
        <details className="result-section">
          <summary>상황별 확인 목록 더 보기</summary>
          <ul>
            {result.additionalChecks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="result-section">
        <summary>
          {result.tailoredResponse
            ? "내 상황에 맞는 다음 대응과 근거"
            : "법률을 참고한 다음 대응"}
        </summary>
        <NextResponse result={result} showDrain={false} showBuilding={false} />
      </details>
      <div className="details-group">
        <details>
          <summary>판단 근거 보기</summary>
          {result.retrieval && (
            <p className="small">
              등록된 근거 자료에서 이 상황과 관련된 내용을 먼저 찾고, 그 자료에
              연결된 설명을 사용했어요.
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
                        {s.technicalStatus === "verified" ? "확인됨" : "대기"}
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
          <button className="text-button" onClick={onEdit}>
            입력 수정하고 다시 확인하기
          </button>
        </details>
      </div>
      {!emergency && !outside && (
        <details className="result-section">
          <summary>관련 판례 원문과 적용 한계</summary>
          <ReferenceCards issue={issue} />
        </details>
      )}
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
