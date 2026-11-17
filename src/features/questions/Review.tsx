import { useLanguage } from "../../app/language";
import { useState } from "react";
import {
  missingPhotoViews,
  photoViewLabels,
  type PhotoView,
} from "../../../shared/photo";
import { PhotoUpload } from "../photos/PhotoUpload";
import { drainFacts, drainQuestions } from "../../../shared/drain";
import {
  lightingStep,
  usesSingleBulbQuestions,
} from "../../../shared/lighting";
import type { AppConfig, Intake } from "../../../shared/schema";
import { intakeIssueName } from "../../../shared/schema";
import {
  answerLabel,
  observationLabel,
  intakeDetails,
  hasReply,
} from "../../../shared/questions";
import { Button, SectionTitle } from "../../components/ui/Elements";
import { hasDanger } from "../../../shared/safety";
import { SafetyNotice } from "./Questions";
export function Review({
  input,
  config,
  accepted,
  onAccept,
  onEdit,
  onAnalyze,
  busy,
  followup,
  photos,
  onPhotos,
  photoConsent,
  onPhotoConsent,
  coveredPhotos,
  onCoveredPhotos,
}: {
  photos: string[];
  onPhotos: (images: string[]) => void;
  photoConsent: boolean;
  coveredPhotos: PhotoView[];
  onCoveredPhotos: (views: PhotoView[]) => void;
  onPhotoConsent: (value: boolean) => void;
  input: Intake;
  config: AppConfig | null;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  onEdit: (step: number) => void;
  onAnalyze: () => void;
  busy: boolean;
  followup: boolean;
}) {
  const { t, language } = useLanguage();
  const [photoBusy, setPhotoBusy] = useState(false);
  const timingStep = usesSingleBulbQuestions(input) ? 6 : 1;
  const rows = [
    ["보이는 증상", observationLabel(input), 0],
    ...drainFacts(input).map((f) => {
      const [id, q] = Object.entries(drainQuestions).find(
        ([, q]) => `drain.${q.key}` === f.key,
      )!;
      return [q.title, f.value, Number(id)] as const;
    }),
    ...intakeDetails(input).map(
      ([title, value]) =>
        [
          title,
          value,
          title === "조명 형태"
            ? lightingStep
            : title.includes("기사") || title.includes("상대방")
              ? 4
              : 6,
        ] as const,
    ),
    ["추가 설명", input.description || "별도 설명 없음", 6],
    ...(input.building
      ? [
          [
            "건물 정보",
            `${input.building.use} · ${input.building.structure} · 승인 ${input.building.approval || "미등록"} · ${input.building.floors}층 (사용자 선택)`,
            6,
          ] as [string, string, number],
        ]
      : []),
    ["발견 시점", answerLabel("discovered", input.discovered), timingStep],
    ["입주 당시", answerLabel("preexisting", input.preexisting), timingStep],
    ...(input.issue !== "drain"
      ? [["시설", answerLabel("installed", input.installed), 2] as const]
      : []),
    ...(hasReply(input) || input.details?.inspection === "yes"
      ? [
          [
            "원인 설명",
            input.cause === "unknown"
              ? "미확인"
              : `${answerLabel("cause", input.cause)} · ${answerLabel("causeSource", input.causeSource)}`,
            3,
          ] as const,
        ]
      : []),
    ...(hasReply(input)
      ? [["다른 주장", answerLabel("otherClaim", input.otherClaim), 3] as const]
      : []),
    ...(input.contract ? [["계약 특약", input.contract, 6] as const] : []),
    ...(input.building
      ? ([
          [
            "시설 교체·수리 이력",
            {
              yes: "이력을 알고 있어요",
              no: "아는 이력이 없어요",
              unknown: "모름",
            }[input.building.repairHistory],
            6,
          ],
          [
            "관리 담당자",
            {
              yes: "연락 가능한 담당자가 있어요",
              no: "아는 담당자가 없어요",
              unknown: "모름",
            }[input.building.manager],
            6,
          ],
        ] as const)
      : []),
    ["위험 신호", answerLabel("safety", input.safety), 5],
    ["연락 상태", answerLabel("contact", input.contact), 4],
  ] as const;
  return (
    <>
      <SectionTitle
        eyebrow={t("자료·검토")}
        title={
          followup
            ? t("추가 안내에 보낼 내용을 확인해 주세요")
            : t("이 내용으로 확인할까요?")
        }
      >
        <p>
          {t(intakeIssueName(input))}{" "}
          {t("· 답변을 확인하고 필요한 부분을 수정하세요.")}
        </p>
      </SectionTitle>
      {followup && (
        <p className="notice">
          {t(
            "아래 답변과 선택한 건물 정보로 다시 안내받아요. 이 화면에서 수정하고 처리 안내를 확인하세요. 기록장 첨부·연락 일지·문구는 기기에 보관돼요.",
          )}
        </p>
      )}
      <dl className="review-list">
        {rows.map(([title, value, step]) => (
          <div key={title}>
            <dt>{t(title)}</dt>
            <dd>
              {language === "en" && title === "고장 난 조명 개수"
                ? input.lightingWork?.count
                : language === "en" && title === "원인 설명"
                  ? value.split(" · ").map(t).join(" · ")
                  : t(value)}
            </dd>
            <button
              className="text-button"
              aria-label={
                language === "en" ? `Edit ${t(title)}` : `${title} 수정`
              }
              onClick={() => onEdit(step)}
            >
              {t("수정")}
            </button>
          </div>
        ))}
      </dl>
      {hasDanger(input) && <SafetyNotice />}
      {!hasDanger(input) && config?.storage !== "browser" && (
        <PhotoUpload
          images={photos}
          onChange={onPhotos}
          onBusy={setPhotoBusy}
        />
      )}
      {photos.length > 0 && missingPhotoViews(input).length > 0 && (
        <details className="processing-notice">
          <summary>{t("이미 찍었거나 갖고 있는 자료 표시 (선택)")}</summary>
          {missingPhotoViews(input).map((view) => (
            <label className="checkbox" key={view}>
              <input
                type="checkbox"
                checked={coveredPhotos.includes(view)}
                onChange={(e) =>
                  onCoveredPhotos(
                    e.target.checked
                      ? [...coveredPhotos, view]
                      : coveredPhotos.filter((v) => v !== view),
                  )
                }
              />
              {t(photoViewLabels[view])}
            </label>
          ))}
        </details>
      )}
      {photos.length > 0 && (
        <label className="checkbox photo-consent">
          <input
            type="checkbox"
            checked={photoConsent}
            onChange={(e) => onPhotoConsent(e.target.checked)}
          />
          <span>
            {language === "en"
              ? config?.ai === "mock"
                ? `I agree to send ${photos.length} photo(s) to the demo server for simulated analysis.`
                : `I agree to send ${photos.length} photo(s) to OpenAI. The result and saved history may include observations and device details. Banglog does not retain the original photos. Mask personal information before uploading.`
              : config?.ai === "mock"
                ? `사진 ${photos.length}장을 개발 서버에 보내는 데 동의해요. 개발용 모의 분석이며 OpenAI는 호출하지 않아요.`
                : `사진 ${photos.length}장을 OpenAI로 보내는 데 동의해요. 사진의 관찰 결과와 기기 오류코드·제조연도, 직접 확인한 값은 결과·회원 기록에 저장될 수 있어요. 방로그 서버는 사진 원본을 저장하지 않아요. 가릴 내용은 첨부 전에 가려주세요.`}
          </span>
        </label>
      )}

      <div className="processing-notice">
        <strong>
          {config?.ai === "live"
            ? t("실제 AI 처리 전 확인해 주세요")
            : t("데모: 가상 결과로 확인해요")}
        </strong>
        <p>
          {config?.ai === "live"
            ? t(
                "가린 상황 설명·선택 답변·계약 문구와 확인한 점검 소견·상대방 답변을 OpenAI에 전송해요. store:false를 사용하며, 제공자의 악용 모니터링 기록은 기본 최대 30일 보관될 수 있어요. 학습용 사용은 기본 비활성화되어 있어요.",
              )
            : t("외부 AI를 호출하지 않고 규칙에 따른 가상 결과를 만들어요.")}
        </p>
        <p>
          {config?.storage === "browser"
            ? t(
                "입력·결과·피드백은 현재 페이지의 메모리에만 보관하며 서버로 전송하지 않아요.",
              )
            : config?.storage === "database"
              ? t("입력·결과·피드백을 서버 DB에 최대 24시간 임시 보관해요.")
              : t(
                  "입력·결과·피드백은 서버 메모리에 최대 24시간, 또는 서버를 끌 때까지 임시 보관해요.",
                )}{" "}
          {t("이용 중 직접 삭제할 수 있어요.")}
        </p>
        <p>
          {config?.storage === "browser"
            ? t(
                "새로고침하거나 페이지를 닫으면 기록이 사라져요. 피드백은 체험용이며 운영자에게 전달되지 않아요.",
              )
            : t(
                "새로고침하면 기록에 다시 접근할 수 없어요. 새로고침 자체가 서버 기록을 삭제하지는 않아요. 원문을 연구·학습용으로 따로 저장하지 않아요.",
              )}
        </p>
        {config?.storage === "database" && (
          <p>
            {t(
              "문제 유형·선택 증상·결과 분류별 일일 완료 건수를 집계해요. 집계에는 식별자와 자유 입력 원문을 넣지 않으며 개별 기록 삭제 후에도 건수는 남아요. v1.5 팀 체험 기간에는 이 익명 집계를 공개 관리자 화면에서 누구나 볼 수 있어요.",
            )}
          </p>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAccept(e.target.checked)}
          />
          <span>
            {t("위 처리 안내를 확인했어요")}
            <small>{t("필수")}</small>
          </span>
        </label>
      </div>
      {config && !config.ready && (
        <p role="alert" className="error">
          {language === "en"
            ? "The analysis service is currently unavailable. Please try again later."
            : config.blockers.join(" · ")}
        </p>
      )}
      <div className="actions sticky-actions">
        <Button
          disabled={
            !accepted ||
            hasDanger(input) ||
            busy ||
            photoBusy ||
            !config?.ready ||
            (photos.length > 0 && !photoConsent)
          }
          onClick={onAnalyze}
        >
          {busy ? t("세션을 준비하고 있어요…") : t("수리 가이드 확인하기")}
        </Button>
      </div>
    </>
  );
}
