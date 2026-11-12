import { useLanguage } from "../../app/language";
import { useRef, useState } from "react";

async function resizePhoto(file: File): Promise<string> {
  if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 15 * 1024 * 1024)
    throw Error(
      "JPG·PNG·WebP 사진을 15MB 이하로 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.width * image.height > 60000000)
      throw Error("사진 크기가 너무 커요. 작은 사진으로 다시 선택해 주세요.");
    const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw Error("사진을 준비하지 못했어요. 사진 없이 계속할 수 있어요.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Re-encode to remove EXIF/location metadata and bound upload size.
    for (const quality of [0.8, 0.6, 0.4]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 400000) return data;
    }
    throw Error(
      "사진 용량을 줄이지 못했어요. 더 작은 사진으로 다시 선택해 주세요.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function PhotoUpload({
  images,
  onChange,
  onBusy,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  async function select(files: FileList | null) {
    if (!files?.length || inFlight.current) return;
    if (images.length + files.length > 3) {
      setError("사진은 최대 3장까지 첨부할 수 있어요.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      onChange([
        ...images,
        ...(await Promise.all(Array.from(files).map(resizePhoto))),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "사진을 읽지 못했어요. 사진 없이 계속할 수 있어요.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="photo-upload result-card" aria-labelledby="photo-title">
      <h2 id="photo-title">
        {t("문제 부위 사진")}
        <small>{t("선택 · 최대 3장")}</small>
      </h2>
      <p className="small">
        {t(
          "전체 모습과 가까이 찍은 사진을 넣어 주세요. 위험한 곳에 접근하거나 기기를 분해해 촬영하지 마세요.",
        )}
      </p>
      <label className="photo-file-label">
        {t("앨범에서 선택")}
        <input
          aria-label={t("문제 사진 선택")}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || images.length >= 3}
          onChange={(e) => {
            void select(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <label className="photo-file-label">
        {t("카메라로 촬영")}
        <input
          aria-label={t("문제 사진 촬영")}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy || images.length >= 3}
          onChange={(e) => {
            void select(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">{t("사진 크기를 줄이고 있어요…")}</p>}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {images.length > 0 && !busy && (
        <p role="status">
          {language === "en"
            ? `${images.length} photo(s) attached`
            : `사진 ${images.length}장 첨부 완료`}
        </p>
      )}
      <div className="photo-previews">
        {images.map((src, index) => (
          <div key={index}>
            <img
              src={src}
              alt={
                language === "en"
                  ? `Attached photo ${index + 1}`
                  : `첨부한 문제 사진 ${index + 1}`
              }
            />
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => onChange(images.filter((_, n) => n !== index))}
            >
              {language === "en"
                ? `Remove photo ${index + 1}`
                : `사진 ${index + 1} 삭제`}
            </button>
          </div>
        ))}
      </div>
      <p className="small">
        {t(
          "사진을 선택하기 전에 얼굴·이름·주소·연락처·제품번호·QR을 가리거나 잘라내세요. 기기 라벨은 제조연월만 보이게 찍어 주세요.",
        )}
      </p>
    </section>
  );
}
