import { useState } from "react";
import { PhotoUpload } from "../photos/PhotoUpload";
import { drainFacts, drainQuestions } from "../../../shared/drain";
import type { AppConfig, Intake } from "../../../shared/schema";
import { issueNames } from "../../../shared/schema";
import { answerLabel, observationLabel } from "../../../shared/questions";
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
  photos,
  onPhotos,
  photoConsent,
  onPhotoConsent,
}: {
  photos: string[];
  onPhotos: (images: string[]) => void;
  photoConsent: boolean;
  onPhotoConsent: (value: boolean) => void;
  input: Intake;
  config: AppConfig | null;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  onEdit: (step: number) => void;
  onAnalyze: () => void;
  busy: boolean;
}) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const rows = [
    ["보이는 증상", observationLabel(input), 0],
    ...drainFacts(input).map((f) => {
      const [id, q] = Object.entries(drainQuestions).find(
        ([, q]) => `drain.${q.key}` === f.key,
      )!;
      return [q.title, f.value, Number(id)] as const;
    }),
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
    ["발견 시점", answerLabel("discovered", input.discovered), 1],
    ["입주 당시", answerLabel("preexisting", input.preexisting), 1],
    ["시설", answerLabel("installed", input.installed), 2],
    [
      "원인 설명",
      `${answerLabel("cause", input.cause)} · ${answerLabel("causeSource", input.causeSource)}`,
      3,
    ],
    ["다른 주장", answerLabel("otherClaim", input.otherClaim), 3],
    ...(input.contract
      ? [["이전에 입력한 계약 문구", input.contract, 6] as const]
      : []),
    ["위험 신호", answerLabel("safety", input.safety), 5],
    ["연락 상태", answerLabel("contact", input.contact), 4],
  ] as const;
  return (
    <>
      <SectionTitle eyebrow="내용 검토" title="이 내용으로 확인할까요?">
        <p>
          {issueNames[input.issue]} · 답변을 확인하고 필요한 부분을 수정하세요.
        </p>
      </SectionTitle>
      <dl className="review-list">
        {rows.map(([title, value, step]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{value}</dd>
            <button
              className="text-button"
              aria-label={`${title} 수정`}
              onClick={() => onEdit(step)}
            >
              수정
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
      {photos.length > 0 && (
        <label className="checkbox photo-consent">
          <input
            type="checkbox"
            checked={photoConsent}
            onChange={(e) => onPhotoConsent(e.target.checked)}
          />
          <span>
            사진 {photos.length}장을 OpenAI로 보내 분석하는 데 동의해요. 사진
            원본은 방로그 DB에 저장하지 않으며 관찰 결과는 기존 결과·회원 기록과
            함께 저장될 수 있어요. 사진의 개인정보는 자동으로 가려지지 않아요.
          </span>
        </label>
      )}

      <div className="processing-notice">
        <strong>
          {config?.ai === "live"
            ? "실제 AI 처리 전 확인해 주세요"
            : "데모: 가상 결과로 확인해요"}
        </strong>
        <p>
          {config?.ai === "live"
            ? "가린 상황 설명·선택 답변·계약 문구를 OpenAI에 전송해요. store:false를 사용하며, 제공자의 악용 모니터링 기록은 기본 최대 30일 보관될 수 있어요. 학습용 사용은 기본 비활성화되어 있어요."
            : "외부 AI를 호출하지 않고 규칙에 따른 가상 결과를 만들어요."}
        </p>
        <p>
          {config?.storage === "browser"
            ? "입력·결과·피드백은 현재 페이지의 메모리에만 보관하며 서버로 전송하지 않아요."
            : config?.storage === "database"
              ? "입력·결과·피드백을 서버 DB에 최대 24시간 임시 보관해요."
              : "입력·결과·피드백은 서버 메모리에 최대 24시간, 또는 서버를 끌 때까지 임시 보관해요."}{" "}
          이용 중 직접 삭제할 수 있어요.
        </p>
        <p>
          {config?.storage === "browser"
            ? "새로고침하거나 페이지를 닫으면 기록이 사라져요. 피드백은 체험용이며 운영자에게 전달되지 않아요."
            : "새로고침하면 기록에 다시 접근할 수 없어요. 새로고침 자체가 서버 기록을 삭제하지는 않아요. 원문을 연구·학습용으로 따로 저장하지 않아요."}
        </p>
        {config?.storage === "database" && (
          <p>
            문제 유형·선택 증상·결과 분류별 일일 완료 건수를 집계해요. 집계에는
            식별자와 자유 입력 원문을 넣지 않으며 개별 기록 삭제 후에도 건수는
            남아요. v1.4 팀 체험 기간에는 이 익명 집계를 공개 관리자 화면에서
            누구나 볼 수 있어요.
          </p>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAccept(e.target.checked)}
          />
          <span>
            위 처리 안내를 확인했어요 <small>필수</small>
          </span>
        </label>
      </div>
      {config && !config.ready && (
        <p role="alert" className="error">
          {config.blockers.join(" · ")}
        </p>
      )}
      <div className="actions sticky-actions">
        <Button
          disabled={
            !accepted ||
            busy ||
            photoBusy ||
            !config?.ready ||
            (photos.length > 0 && !photoConsent)
          }
          onClick={onAnalyze}
        >
          {busy ? "세션을 준비하고 있어요…" : "수리 가이드 확인하기"}
        </Button>
      </div>
    </>
  );
}
