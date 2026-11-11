import { useId } from "react";
import type { Issue } from "../../../shared/schema";

import {
  photoSigns,
  photoChecks,
  type PhotoResult as PhotoReading,
} from "../../../shared/photo";
export function PhotoResult({ photo }: { photo?: PhotoReading }) {
  const titleId = useId();
  if (!photo) return null;
  return (
    <section className="result-card photo-result" aria-labelledby={titleId}>
      <p className="eyebrow">사진 {photo.count}장 · 선택 답변과 별도 관찰</p>
      <h2 id={titleId}>사진에서 확인한 내용</h2>
      {photo.status === "analyzed" ? (
        <>
          <p>GPT가 관찰한 징후이며 실제 원인 진단은 아니에요.</p>
          {photo.signs.length ? (
            <ul>
              {photo.signs.map((sign) => (
                <li key={sign}>
                  <strong>{photoSigns[sign]}</strong>
                  <p>{photoChecks[sign]}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              뚜렷한 징후를 찾지 못했어요. 문제가 없거나 안전하다는 뜻은
              아니에요.
            </p>
          )}
        </>
      ) : (
        <p role="status">
          {photo.status === "failed"
            ? "사진 분석에 실패해 선택한 답변으로 안내했어요."
            : photo.status === "skipped"
              ? "이번에는 사진 분석을 실행하지 않았어요. 선택한 답변으로 안내했어요."
              : "사진만으로 문제 부위를 확인하기 어려워 선택한 답변으로 안내했어요."}
        </p>
      )}
      <p className="small">
        배관 내부·누수 원인·과실 비율은 사진으로 확정할 수 없어요. 아래 해결
        안내는 기존 답변과 사용 가능한 근거에 따라 제공해요. 원본 사진은 방로그
        DB에 저장하지 않고 관찰 결과만 함께 보관해요.
      </p>
    </section>
  );
}

const coaching: Record<Issue, [string, string][]> = {
  boiler: [
    ["설치된 보일러 전체", "설비 위치를 보여줘요."],
    ["겉면의 제조연월 표시", "제품과 교체 이력을 확인할 수 있어요."],
    ["실내 조절기 오류 코드", "업체가 점검할 부분을 좁힐 수 있어요."],
  ],
  mold: [
    ["방과 얼룩이 함께 보이는 사진", "창·벽·가구와의 위치 관계를 보여줘요."],
    ["얼룩 근접 사진", "범위와 변화를 비교할 수 있어요."],
    ["재발한 날의 같은 구도", "재발 시점과 범위를 남길 수 있어요."],
  ],
  leak: [
    ["누수 지점과 주변 전체", "젖은 위치와 피해 범위를 남겨요."],
    [
      "안전한 거리에서 보이는 물 흐름",
      "점검 담당자가 물이 보이는 방향을 확인할 수 있어요.",
    ],
  ],
  surface: [
    ["같은 위치의 전체·근접 사진", "손상 범위와 부분 보수 가능성을 확인해요."],
    ["입주 당시 같은 위치 사진 또는 점검표", "기존 상태를 대조할 수 있어요."],
  ],
  drain: [
    ["배수구와 주변 바닥", "문제 위치와 넘침 흔적을 남겨요."],
    ["이미 보이는 배수 상태와 다른 배수구", "한 곳인지 여러 곳인지 비교해요."],
  ],
  fixture: [
    ["제품 전체와 보이는 오류 표시", "대상 제품과 증상을 구분해요."],
    [
      "계약 옵션 목록 중 관련 항목",
      "제공 주체 확인에 도움이 돼요. 개인 정보는 가려요.",
    ],
  ],
};
export function PhotoCoaching({ issue }: { issue: Issue }) {
  return (
    <details className="result-card">
      <summary>추가로 남겨두면 좋은 사진</summary>
      <ul>
        {coaching[issue].map(([title, reason]) => (
          <li key={title}>
            <strong>{title}</strong>
            <p>{reason}</p>
          </li>
        ))}
      </ul>
      <p className="small">
        안전한 곳에서 보이는 부분만 찍으세요. 전기·가스·뜨거운 부위에 접근하거나
        높은 곳에 오르지 말고, 설비를 열거나 증상을 재현하지 마세요.
      </p>
      <p className="small">
        얼굴·주소·계약 개인정보·불필요한 제품번호는 가려주세요. 사진은 점검을
        돕는 자료예요.
      </p>
    </details>
  );
}
