import { BuildingGuide } from "./BuildingGuide";
import { DrainGuide } from "./DrainGuide";
import type { Analysis } from "../../../shared/schema";
const law = (article: string) =>
  `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=${article}&lsiSeq=284415&urlMode=lsScJoRltInfoR`;
function CommonResponse({ result }: { result: Analysis }) {
  if (result.status === "safety_priority" || result.status === "out_of_scope")
    return null;
  const cost = result.messageKind === "cost";
  const waiting = result.messageKind !== "initial" && !cost;
  return (
    <section className="next-response">
      <p className="eyebrow">법률을 참고한 다음 대응</p>
      <h2>
        {cost
          ? "비용을 내라고 하면 이렇게 확인해요"
          : waiting
            ? "답변이 없거나 협의가 막혔다면"
            : "연락한 뒤에는 이렇게 진행해요"}
      </h2>
      <p className="small">
        일반적인 절차 안내예요. AI의 개별 판단이나 전문가 법률 검토가 아니며,
        계약·원인·증거에 따라 달라져요.
      </p>
      {result.fallback && (
        <p className="small">
          현재 AI 분석은 완료되지 않았어요. 아래는 공식 자료를 참고한 공통
          안내예요.
        </p>
      )}
      <ol className="response-steps">
        <li>
          <h3>
            {waiting
              ? "보낸 요청과 답변을 다시 정리해요"
              : "수리가 필요한 사실을 알려요"}
          </h3>
          <p>
            발견 시점·증상·생활에 미치는 영향을 알리고 점검 일정을 요청하세요.
            보낸 문자와 답변, 사진은 직접 보관해요.
          </p>
          <p className="small">
            민법 제634조는 수리가 필요하면 임대인에게 지체 없이 알리도록 해요.
            이미 알고 있다면 예외예요.
          </p>
          <a href={law("0634")} target="_blank" rel="noreferrer">
            민법 제634조 · 통지의무 ↗
          </a>
        </li>
        <li>
          <h3>
            {cost
              ? "바로 지급하기 전, 원인과 견적을 확인해요"
              : "점검 결과와 수리 범위를 확인해요"}
          </h3>
          <p>
            고장 원인, 수리·교체가 필요한 이유, 항목별 견적과 계약 특약을
            확인하고 비용 부담을 협의하세요.
          </p>
          <p className="small">
            민법 제623조의 사용·수익에 필요한 상태 유지 의무를 참고해요. 사소한
            수선인지, 사용에 지장이 있는지 등에 따라 범위가 달라져요. 집주인이
            모든 비용을 부담한다는 뜻은 아니에요.
          </p>
          <a href={law("0623")} target="_blank" rel="noreferrer">
            민법 제623조 · 임대인의 의무 ↗
          </a>
        </li>
        <li>
          <h3>먼저 비용을 썼다면 지출 근거를 모아요</h3>
          <p>
            수리 전후 사진, 견적·영수증, 점검 내용과 연락 기록을 보관하세요.
            민법 제626조는 보존에 필요한 비용의 상환 청구를 규정하지만, 내
            지출이 해당하는지는 별도 확인이 필요해요. 전액 환급을 보장하지
            않아요.
          </p>
          <a href={law("0626")} target="_blank" rel="noreferrer">
            민법 제626조 · 필요비 상환 ↗
          </a>
        </li>
        <li>
          <h3>해결되지 않으면 상담·분쟁조정을 검토해요</h3>
          <p>
            계약서, 하자·점검 기록, 연락 내역, 견적을 정리해 상담받으세요.
            유지·수선 의무 분쟁은 임대차분쟁조정 대상에 포함돼요. 접수 요건과
            진행 절차는 기관에서 확인하세요.
          </p>
          <a
            href="https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1415"
            target="_blank"
            rel="noreferrer"
          >
            한국부동산원 · 임대차분쟁조정 안내 ↗
          </a>
        </li>
      </ol>
      <p className="small">
        임의로 월세를 중단하거나 수리비를 빼고 보내기 전에는 법률 상담을
        받아보세요. 여기서 회신 기한·해지 가능 여부·승소 여부를 확정하지 않아요.
      </p>
      <p className="small">공식 자료 확인: 2026.11.03 · 전문가 법률 검토 전</p>
    </section>
  );
}

function NextResponseBody({ result }: { result: Analysis }) {
  if (result.status === "safety_priority" || result.status === "out_of_scope")
    return null;
  if (!result.tailoredResponse || result.fallback || result.mode !== "live")
    return (
      <>
        <p className="notice">
          {result.fallback
            ? "맞춤 대응을 생성하지 못했어요. 아래는 공통 안내예요."
            : "이 기록에는 GPT 맞춤 대응이 없어요. 아래는 공통 안내이며, 새로 분석하면 맞춤 대응을 확인할 수 있어요."}
        </p>
        <CommonResponse result={result} />
      </>
    );
  const plan = result.tailoredResponse;
  return (
    <section className="next-response tailored-response">
      <p className="eyebrow">GPT 맞춤 대응 · DB 근거 연결</p>
      <h2>내 상황에서는 이렇게 대응해요</h2>
      <p>{plan.summary}</p>
      <p className="small">
        입력한 내용과 DB에서 찾은 자료를 바탕으로 제안했어요. 사실관계와 법률
        적용은 추가 확인이 필요해요.
      </p>
      <ol className="response-steps">
        {plan.steps.map((step, index) => (
          <li key={index}>
            <h3>{step.title}</h3>
            <p>
              <strong>이렇게 해보세요</strong>
              <br />
              {step.action}
            </p>
            <p>
              <strong>이유와 적용 한계</strong>
              <br />
              {step.reason}
            </p>
            {step.missingEvidence.length > 0 && (
              <div className="notice">
                <strong>먼저 확인할 내용</strong>
                <ul>
                  {step.missingEvidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <details>
              <summary>이 대응에 반영한 내 답변</summary>
              {step.factKeys.map((key) => {
                const fact = result.userReportedFacts.find(
                  (f) => f.key === key,
                );
                return (
                  fact && (
                    <p className="small" key={key}>
                      {fact.value} ·{" "}
                      {fact.provenance === "landlord_claim"
                        ? "상대방 주장"
                        : fact.provenance === "relayed_technician"
                          ? "전해 들은 점검 소견"
                          : "사용자 진술·미검증"}
                    </p>
                  )
                );
              })}
            </details>
            <div className="response-evidence">
              <p className="eyebrow">연결된 법률·판례</p>
              {step.citations.map((c) => {
                const source = result.sources.find(
                  (s) => s.id === c.sourceId && s.version === c.sourceVersion,
                );
                return (
                  source && (
                    <div
                      className="source"
                      key={`${c.sourceId}:${c.sourceVersion}`}
                    >
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title} ↗
                      </a>
                      <p>{c.claim}</p>
                      <p className="small">적용 범위·한계: {source.scope}</p>
                      <details>
                        <summary>출처 확인 정보</summary>
                        <p className="small">
                          {source.institution} · {c.location}
                          <br />
                          자료 확인일: {source.checkedAt}
                          <br />
                          원문·기술 확인:{" "}
                          {source.technicalStatus === "verified"
                            ? "확인됨"
                            : "대기"}
                          <br />
                          전문가 법률 검토:{" "}
                          {source.humanLegalReview === "approved"
                            ? "승인"
                            : "대기"}
                          <br />
                          자료 버전: {source.version}
                        </p>
                      </details>
                    </div>
                  )
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="small">
        법적 책임·환급·승소를 보장하지 않아요. 근거와 내 상황이 다르거나 다툼이
        계속되면 계약서·점검 기록·실제 답변을 지참해 법률 상담을 받아보세요.
      </p>
      <p className="small">
        분석 당시 자료: {result.retrieval?.datasetVersion} · 이후 상황 변화는 새
        분석에 반영해 주세요.
      </p>
    </section>
  );
}

export function NextResponse({
  result,
  showDrain = true,
  showBuilding = true,
}: {
  result: Analysis;
  showDrain?: boolean;
  showBuilding?: boolean;
}) {
  return (
    <>
      {showDrain && <DrainGuide result={result} />}
      {showBuilding && <BuildingGuide result={result} />}
      <NextResponseBody result={result} />
    </>
  );
}
