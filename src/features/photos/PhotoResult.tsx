import { useId, useState } from "react";
import type { Issue } from "../../../shared/schema";
import {
  photoDeviceSchema,
  photoGuidance,
  photoSigns,
  photoViewsByIssue,
  type PhotoDevice,
  type PhotoResult as PhotoReading,
  type PhotoView,
} from "../../../shared/photo";
import { Button } from "../../components/ui/Elements";

const photoStatus: Record<PhotoReading["status"], string> = {
  analyzed: "AI 사진 분석 완료",
  unclear: "사진에서 확인하기 어려움",
  failed: "사진 분석에 실패해 선택한 답변으로 안내했어요.",
  skipped: "이번에는 사진 분석을 실행하지 않았어요.",
  mock: "개발용 모의 분석 · 실제 AI 분석 아님",
};

export function PhotoResult({
  photo,
  onConfirm,
  onRetry,
  busy,
}: {
  photo?: PhotoReading;
  onConfirm?: (device: PhotoDevice) => void;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  if (!photo) return null;
  const status =
    photo.source === "mock" && photo.status !== "failed"
      ? "mock"
      : photo.status;
  const isObserved = photo.source === "openai" || !photo.source;
  return (
    <section className="result-card photo-result" aria-labelledby={titleId}>
      <h2 id={titleId}>사진에서 확인한 내용</h2>
      <p role="status">
        <strong>
          {busy
            ? "사진과 안내를 다시 확인하고 있어요…"
            : status === "analyzed" && !photo.source
              ? "이전에 저장한 사진 관찰"
              : status === "unclear" && photo.source === "openai"
                ? "AI 사진 분석 완료 · 사진에서 확인하기 어려움"
                : photoStatus[status]}
        </strong>{" "}
        · 사진 {photo.count}장
      </p>
      {isObserved && photo.observations && (
        <ul className="photo-observations">
          {photo.observations.map((reading, index) => (
            <li key={index}>
              <strong>사진 {index + 1}</strong>
              <p>{reading.visualSummary}</p>
              {reading.detectedErrorCode && (
                <p>
                  오류코드 후보 <strong>{reading.detectedErrorCode}</strong>
                </p>
              )}
              {reading.detectedManufactureYear && (
                <p>
                  제조연도 후보{" "}
                  <strong>{reading.detectedManufactureYear}년</strong>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {isObserved &&
        status === "analyzed" &&
        !photo.observations &&
        (photo.signs.length ? (
          <p>{photo.signs.map((sign) => photoSigns[sign]).join(" · ")}</p>
        ) : (
          <p>뚜렷한 징후를 찾지 못했어요.</p>
        ))}
      {photo.userConfirmed && (
        <p>
          사용자 확인값 ·{" "}
          {[
            photo.userConfirmed.detectedErrorCode &&
              `오류코드 ${photo.userConfirmed.detectedErrorCode}`,
            photo.userConfirmed.detectedManufactureYear &&
              `제조연도 ${photo.userConfirmed.detectedManufactureYear}년`,
          ]
            .filter(Boolean)
            .join(" · ") || "확인된 기기 정보 없음"}
        </p>
      )}
      {onConfirm &&
        photo.source === "openai" &&
        ["analyzed", "unclear"].includes(status) && (
          <DeviceConfirmation photo={photo} onConfirm={onConfirm} busy={busy} />
        )}
      {(status === "analyzed" || status === "unclear") && (
        <p className="small">
          사진으로는 고장 원인, 배관 내부, 수리비 부담을 확인할 수 없어요.
          오류코드의 의미는 해당 기기의 설명서나 점검을 통해 확인해 주세요.
        </p>
      )}
      {onRetry && status === "failed" && (
        <Button secondary onClick={onRetry} disabled={busy}>
          같은 사진으로 한 번 더 분석하기
        </Button>
      )}
    </section>
  );
}

function DeviceConfirmation({
  photo,
  onConfirm,
  busy,
}: {
  photo: PhotoReading;
  onConfirm: (device: PhotoDevice) => void;
  busy?: boolean;
}) {
  const unique = <T,>(items: (T | null)[]) => {
    const values = [...new Set(items.filter((value) => value !== null))];
    return values.length === 1 ? values[0] : null;
  };
  const suggestedCode = unique(
    (photo.observations ?? []).map((r) => r.detectedErrorCode),
  );
  const suggestedYear = unique(
    (photo.observations ?? []).map((r) => r.detectedManufactureYear),
  );
  const [code, setCode] = useState(
    photo.userConfirmed
      ? (photo.userConfirmed.detectedErrorCode ?? "")
      : (suggestedCode ?? ""),
  );
  const [year, setYear] = useState(
    String(
      (photo.userConfirmed
        ? photo.userConfirmed.detectedManufactureYear
        : suggestedYear) ?? "",
    ),
  );
  const [error, setError] = useState("");
  const currentYear = new Date().getFullYear();
  return (
    <details>
      <summary>기기 정보 확인·수정</summary>
      <p className="small">
        기기에서 직접 확인한 값만 입력해 주세요. 모르는 항목은 비워둘 수 있어요.
        확인값을 바탕으로 안내를 다시 요청할 수 있어요.
      </p>
      <form
        className="photo-device-form"
        onSubmit={(event) => {
          event.preventDefault();
          const device = photoDeviceSchema.safeParse({
            detectedErrorCode: code.trim().toUpperCase() || null,
            detectedManufactureYear: year.trim() ? Number(year) : null,
          });
          if (
            !device.success ||
            (year.trim() &&
              (!/^\d{4}$/.test(year.trim()) || Number(year) > currentYear))
          ) {
            setError(
              "오류코드는 E03 또는 01 같은 형식으로, 제조연도는 네 자리로 입력해 주세요.",
            );
            return;
          }
          setError("");
          onConfirm(device.data);
        }}
      >
        <label>
          확인한 오류코드
          <input
            value={code}
            maxLength={7}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label>
          확인한 제조연도
          <input
            value={year}
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button
          secondary
          type="submit"
          disabled={
            busy ||
            (photo.userConfirmed
              ? (photo.userConfirmed.detectedErrorCode ?? "") ===
                  code.trim().toUpperCase() &&
                String(photo.userConfirmed.detectedManufactureYear ?? "") ===
                  year.trim()
              : !code.trim() &&
                !year.trim() &&
                suggestedCode === null &&
                suggestedYear === null)
          }
        >
          확인한 정보로 안내 다시 받기
        </Button>
      </form>
    </details>
  );
}

export function PhotoCoaching({
  issue,
  suggestions,
  expanded = false,
}: {
  issue: Issue;
  suggestions?: PhotoView[];
  expanded?: boolean;
}) {
  const items = photoGuidance(suggestions ?? photoViewsByIssue[issue]);
  if (!items.length) return null;
  return (
    <details className="result-card" open={expanded}>
      <summary>추가로 남겨두면 좋은 사진</summary>
      <ul>
        {items.map(({ key, title, reason }) => (
          <li key={key}>
            <strong>{title}</strong>
            <p>{reason}</p>
          </li>
        ))}
      </ul>
      <p className="small">
        안전한 곳에서 보이는 부분만 찍으세요. 설비를 분해하거나 증상을 재현하지
        마세요. 사진을 첨부하기 전에 얼굴·이름·주소·제품번호를 가려주세요.
      </p>
    </details>
  );
}
