import { ReferenceCards } from "../references/References";
import type { Analysis, Issue } from "../../../shared/schema";
import { directionNames } from "../../../shared/schema";
import { Button, SectionTitle } from "../../components/ui/Elements";
import { SafetyNotice } from "../questions/Questions";
export function Result({
  result,
  issue,
  onMessage,
  onEdit,
  onFeedback,
}: {
  result: Analysis;
  issue: Issue;
  onMessage: () => void;
  onEdit: () => void;
  onFeedback: () => void;
}) {
  const emergency = result.status === "safety_priority",
    outside = result.status === "out_of_scope";
  return (
    <>
      <SectionTitle
        eyebrow={
          result.mode === "mock"
            ? "데모: 가상 결과"
            : "AI 보조 안내 · 내부 검증용"
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
      {emergency && <SafetyNotice />}
      <section className="result-lead">
        <p className="eyebrow">01 · 누구에게 먼저 요청할까요?</p>
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
      <section className="result-section">
        <p className="eyebrow">02 · 제가 비용을 내야 하나요?</p>
        <h2>{directionNames[result.costResponsibility.direction]}</h2>
        {result.costResponsibility.conditions.map((c) => (
          <p key={c}>{c}</p>
        ))}
        {result.decisionPaths.length > 0 && (
          <div className="decision-paths">
            <h3>무엇이 확인되면 달라지나요?</h3>
            {result.decisionPaths.map((path) => (
              <div key={path.outcome}>
                <p>
                  아래가 확인되면{" "}
                  <strong>{directionNames[path.outcome]}</strong>
                  {path.outcome === "mixed" ? "으로" : "로"} 안내해요.
                </p>
                <ul>
                  {path.needs.map((need) => (
                    <li key={need}>{need}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="small">{result.costResponsibility.uncertainty}</p>
        {result.conflictingFacts.map((c) => (
          <p className="notice" key={c}>
            {c}
          </p>
        ))}
      </section>
      <section className="result-section">
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
      {result.messageDraft && (
        <Button onClick={onMessage}>
          {result.repairRequest.recipient === "manager"
            ? "관리 담당자에게 보낼 문구 보기"
            : result.repairRequest.recipient === "service"
              ? "수리업체에 보낼 문구 보기"
              : "집주인에게 보낼 문구 보기"}
        </Button>
      )}
      <div className="details-group">
        <details>
          <summary>판단 근거 보기</summary>
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
                        {s.humanLegalReview === "approved" ? "승인" : "대기"}
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
              이 결과는 질문별 규칙을 보여주는 가상 예시예요. 개별 결론에 법률
              출처를 연결하지 않았어요.
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
      <button className="text-button" onClick={onFeedback}>
        가이드에 대한 의견 남기기
      </button>
    </>
  );
}
