import type { Analysis, Issue } from "../../../shared/schema";
import { directionNames } from "../../../shared/schema";

const evidence: Record<Issue, string> = {
  drain:
    "막힌 위치·원인과 여러 배수구의 동시 증상, 이미 해본 조치를 기록하세요. 입주 후 막혔거나 간단한 조치가 실패했다는 사실만으로 과실은 정해지지 않아요.",
  mold: "곰팡이 위치·발생 시점, 누수·단열 점검 결과와 환기·난방 상황을 함께 남기세요. 곰팡이가 생겼다는 사실만으로 관리 소홀이라고 단정하지 않아요.",
  leak: "물이 새는 위치·시점과 윗집·공용배관·전용배관 점검 결과를 남기세요. 원인에 따라 집주인 외 관리 주체나 제3자 확인이 필요해요.",
  boiler:
    "오류 코드, 점검 소견, 설비의 교체·수리 이력을 확보하세요. 건물 연식만으로 보일러의 노후나 사용자 과실을 판단하지 않아요.",
  surface:
    "입주 당시와 현재 사진, 거주 기간, 손상 부위와 견적 내역을 비교하세요. 통상적인 사용 흔적과 별도 훼손을 구분해 확인해야 해요.",
  fixture:
    "계약서의 옵션 목록, 제품 소유자, 고장 원인과 수리 이력을 확인하세요. 원래 제공된 옵션인지 직접 설치한 제품인지도 중요해요.",
};

export function Responsibility({
  result,
  issue,
}: {
  result: Analysis;
  issue: Issue;
}) {
  if (result.status === "safety_priority" || result.status === "out_of_scope")
    return null;
  const direction = result.costResponsibility.direction;
  return (
    <section
      className="result-section result-card responsibility"
      aria-labelledby="responsibility-title"
    >
      <p className="eyebrow">02 · 양쪽 입장에서 살펴봐요</p>
      <h2 id="responsibility-title">임차인과 임대인, 누가 부담하나요?</h2>
      <div
        className="responsibility-ratio"
        role="group"
        aria-label="책임 비율: 현재 자료로 산정 불가"
      >
        <div className="responsibility-ratio-labels">
          <span>
            임차인 <strong>미산정</strong>
          </span>
          <span>
            임대인 <strong>미산정</strong>
          </span>
        </div>
        <div className="responsibility-track" aria-hidden="true" />
        <p>
          <strong>책임 비율은 아직 산정할 수 없어요</strong>
        </p>
        <p className="small">
          이 표시는 50:50이나 면책을 뜻하지 않아요. 원인·계약·손해 범위를 확인한
          뒤 당사자 합의나 개별 법률 검토가 필요해요.
        </p>
      </div>
      <p className="direction-badge">{directionNames[direction]}</p>
      <p className="small">
        아래는 현재 입력에 따른 검토 방향이며, 과실 비율이나 확정된 법률 판단이
        아니에요.
      </p>
      <div className="responsibility-parties">
        <article
          className="responsibility-party"
          data-active={direction === "tenant" || direction === "mixed"}
        >
          <h3>임차인 · 세입자</h3>
          <p className="responsibility-state">
            {direction === "tenant" || direction === "mixed"
              ? "사용·관리 요인 검토"
              : "사용·관리 원인 확인 필요"}
          </p>
          <p>
            사용 중 파손이나 관리 문제로 생긴 손상인지 확인해요. 상대방의
            주장만으로 책임이 확정되지는 않아요.
          </p>
          <p>
            <strong>지금 할 일</strong> · 발견한 문제를 알리고 사진·연락 기록을
            보관하세요. 비용을 요구받으면 원인과 수리 범위, 견적 내역을
            요청하세요.
          </p>
        </article>
        <article
          className="responsibility-party"
          data-active={direction === "landlord" || direction === "mixed"}
        >
          <h3>임대인 · 집주인</h3>
          <p className="responsibility-state">
            {direction === "landlord" || direction === "mixed"
              ? "시설·노후 요인 검토"
              : "시설·노후 원인 확인 필요"}
          </p>
          <p>
            주택을 사용하는 데 필요한 수선인지, 원래 시설의 노후·결함인지
            확인해요. 사소한 수선인지와 계약 내용도 함께 살펴봐요.
          </p>
          <p>
            <strong>함께 확인할 일</strong> · 접수한 증상과 이전 수리 내역을
            비교하고 점검 일정·원인·수리 범위와 비용 내역을 공유하세요.
          </p>
        </article>
      </div>
      <details className="responsibility-evidence" open>
        <summary>내 상황에서 확보할 근거</summary>
        <p>{evidence[issue]}</p>
        {result.costResponsibility.conditions.map((c) => (
          <p key={c}>{c}</p>
        ))}
        <p className="small">{result.costResponsibility.uncertainty}</p>
        {result.conflictingFacts.map((c) => (
          <p className="notice" key={c}>
            {c}
          </p>
        ))}
      </details>
      <p className="small">
        수리를 요청받는 사람과 최종 비용 부담자는 다를 수 있어요. 수선 의무가 곧
        손해배상 과실 비율을 뜻하지는 않아요. 공용부분·제3자 원인은 별도로
        확인해요.
      </p>
      <details>
        <summary>양측 권리·의무의 일반 안내 출처</summary>
        <p className="small">
          아래는 일반 안내이며 이번 사례의 책임 비율을 산정한 근거는 아니에요.
        </p>
        <a
          href="https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=1&csmSeq=629"
          target="_blank"
          rel="noreferrer"
        >
          생활법령정보 · 임차인의 권리·의무 ↗
        </a>
        <a
          href="https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629"
          target="_blank"
          rel="noreferrer"
        >
          생활법령정보 · 임대인의 권리·의무 ↗
        </a>
        <p className="small">
          민법 제623조의 수선 의무와 제634조의 통지 의무 등 참고 · 확인일
          2026-11-10
        </p>
      </details>
    </section>
  );
}
