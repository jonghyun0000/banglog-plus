import { sourceLink } from "../../../shared/source-link";
import type { Issue } from "../../../shared/schema";
import { referenceCases } from "../../../shared/references";
import { Button, SectionTitle } from "../../components/ui/Elements";

export function ReferenceCards({ issue }: { issue?: Issue }) {
  return (
    <div className="reference-cards">
      <p className="small">
        국가법령정보센터 원문 확인: 2026.10.21 · 전문가 법률 검토 전. 아래
        판례는 참고 자료이며, 현재 입력에 대한 판정 근거로 자동 적용하지 않아요.
      </p>
      {referenceCases
        .filter((c) => !issue || c.issues.includes(issue))
        .map((c) => (
          <article className="source" key={c.id}>
            <p className="eyebrow">판결 원문 확인 · {c.date}</p>
            <h3>{c.title}</h3>
            <p>{c.summary}</p>
            <p className="small">
              <strong>적용 한계</strong> · {c.limit}
            </p>
            <p className="small">확인할 것 · {c.takeaway}</p>
            <a href={sourceLink(c.url)} target="_blank" rel="noreferrer">
              국가법령정보센터 판결 원문 ↗
            </a>
          </article>
        ))}
    </div>
  );
}
export function References({ onStart }: { onStart: () => void }) {
  return (
    <>
      <SectionTitle
        eyebrow="수리 전 참고 자료"
        title="비슷한 사건도 조건이 달라요"
      >
        <p>판결이 다룬 상황과 내 상황의 차이를 먼저 살펴봐요.</p>
      </SectionTitle>
      <h2>확인한 판례</h2>
      <ReferenceCards />
      <section className="result-section">
        <h2>벽지·장판은 무엇을 남길까요?</h2>
        <p>
          입주 당시 사진, 손상 위치와 크기, 교체 시기와 사용 기간, 부분 보수와
          전체 교체의 견적을 구분해서 보관해요. 사진은 직접 보관하고, 이
          데모에는 올리지 않아요.
        </p>
        <p>
          통상 마모와 별도 훼손을 구분해야 해요. 다른 사건의 인정 금액이나
          소송비용 비율을 내 수리비에 그대로 적용하지 않아요.
        </p>
      </section>
      <section className="result-section">
        <h2>신축 주택에도 사용할 수 있나요?</h2>
        <p>
          세입자가 겪는 증상 정리와 집주인에게 보낼 점검 요청 문구는 만들 수
          있어요. 시공사 대상 하자보수 청구나 보증기간 판단은 별도 검토가
          필요하며, 현재 지원 범위에 포함되지 않아요.
        </p>
      </section>
      <Button onClick={onStart}>내 상황 확인하기</Button>
    </>
  );
}
