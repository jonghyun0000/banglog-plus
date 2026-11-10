import {
  photoSigns,
  photoChecks,
  type PhotoResult as PhotoReading,
} from "../../../shared/photo";
export function PhotoResult({ photo }: { photo?: PhotoReading }) {
  if (!photo) return null;
  return (
    <section
      className="result-card photo-result"
      aria-labelledby="photo-result-title"
    >
      <p className="eyebrow">사진 {photo.count}장 · 선택 답변과 별도 관찰</p>
      <h2 id="photo-result-title">사진에서 확인한 내용</h2>
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
