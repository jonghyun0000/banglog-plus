import { BuildingLookup } from "./BuildingLookup";
import {
  drainQuestions,
  drainOptions,
  questionSteps,
} from "../../../shared/drain";
import { useState } from "react";
import { defaultDrain, issueNames, type Intake } from "../../../shared/schema";
import {
  options,
  titles,
  descriptionHints,
  observations,
  issueGuidance,
} from "../../../shared/questions";
import {
  hasDanger,
  safetyText,
  safetyUrl,
  maskPersonalData,
} from "../../../shared/safety";
import { Button, Choice, SectionTitle } from "../../components/ui/Elements";
export function SafetyNotice() {
  return (
    <aside className="safety-notice" role="alert">
      <strong>지금은 안전 확인이 먼저예요</strong>
      <p>{safetyText}</p>
      <a href="tel:119">119에 전화하기</a>
      <a href={safetyUrl} target="_blank" rel="noreferrer">
        소방청 안전 안내 ↗
      </a>
      <p className="small">
        위험이 계속되면 질문을 중단하세요. 이 화면은 위험 여부를 진단하지
        않아요.
      </p>
    </aside>
  );
}
export function Questions({
  input,
  step,
  onChange,
  onNext,
}: {
  input: Intake;
  step: number;
  onChange: (patch: Partial<Intake>) => void;
  onNext: (patch?: Partial<Intake>) => void;
}) {
  const [autoAdvance, setAutoAdvance] = useState(true);
  const danger = hasDanger(input);
  function choose(patch: Partial<Intake>, advance = false) {
    onChange(patch);
    if (advance && autoAdvance && !hasDanger({ ...input, ...patch }))
      onNext(patch);
  }
  function choices(key: keyof typeof options, legend: string, quick = false) {
    return (
      <fieldset className={step === 1 ? "compact-answers" : undefined}>
        <legend>{legend}</legend>
        <div className="choices">
          {options[key].map(([value, label]) =>
            quick ? (
              <button
                type="button"
                key={value}
                className={`choice ${input[key] === value ? "selected" : ""}`}
                aria-pressed={input[key] === value}
                onClick={() =>
                  choose(
                    { [key]: value },
                    key !== "safety" ||
                      !["gas", "fire", "electric"].includes(value),
                  )
                }
              >
                {label}
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Choice
                key={value}
                value={value}
                name={key}
                label={label}
                current={input[key]}
                onChange={(v) => choose({ [key]: v })}
              />
            ),
          )}
        </div>
      </fieldset>
    );
  }
  const sensitive =
    maskPersonalData(input.description) !== input.description ||
    maskPersonalData(input.contract) !== input.contract;
  const drainQuestion =
    input.issue === "drain"
      ? drainQuestions[step as keyof typeof drainQuestions]
      : undefined;
  const path = questionSteps(input);
  const customLocation = step === 7 && input.drain?.location === "other";
  const emptyLocation = customLocation && !input.drain?.locationDetail?.trim();
  return (
    <div className="question-screen">
      <div className="question-context">
        <span>{issueNames[input.issue]}</span>
        <span>
          {input.issue === "drain"
            ? step === 6
              ? "마지막 설명"
              : (drainQuestion?.phase ??
                (step === 4 || step === 3 ? "연락 상황" : "상태 확인"))
            : step === 6
              ? "마지막 질문"
              : `${step + 1} / ${titles.length}`}
        </span>
      </div>
      <progress
        className="question-progress"
        value={path.indexOf(step) + 1}
        max={path.length}
        aria-label="질문 진행 상황"
      />
      <SectionTitle
        title={
          step === 2 && input.issue === "mold"
            ? "문제가 생긴 곳은 어떤 시설인가요?"
            : (drainQuestion?.title ?? titles[step])
        }
      >
        <p>
          {step === 0
            ? autoAdvance
              ? "보이는 증상을 누르면 다음으로 넘어가요."
              : "답을 바꿔 선택할 수 있어요. 확인한 뒤 다음을 눌러주세요."
            : step === 1
              ? "두 항목을 선택한 뒤 다음을 눌러주세요. 몰라도 괜찮아요."
              : step === 3
                ? "원인을 몰라도 괜찮아요. 추측과 점검 결과를 구분해요."
                : step === 5
                  ? "위험 신호가 있으면 진행을 중단해요."
                  : step === 6
                    ? "없으면 바로 넘어가도 괜찮아요."
                    : autoAdvance
                      ? "선택하면 다음으로 넘어가요."
                      : "답을 바꿔 선택할 수 있어요. 확인한 뒤 다음을 눌러주세요."}
        </p>
      </SectionTitle>
      <div className="question-controls">
        <label>
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
          />{" "}
          선택 후 바로 이동
        </label>
      </div>
      {step === path[0] && (
        <p className="small question-review-hint">
          마지막에 답변을 확인하고 수정할 수 있어요.
        </p>
      )}
      {drainQuestion && (
        <div className="choices" role="group" aria-label={drainQuestion.title}>
          {drainOptions[drainQuestion.key].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`choice ${(input.drain ?? defaultDrain)[drainQuestion.key] === value ? "selected" : ""}`}
              aria-pressed={
                (input.drain ?? defaultDrain)[drainQuestion.key] === value
              }
              onClick={() =>
                choose(
                  {
                    drain: {
                      ...(input.drain ?? defaultDrain),
                      [drainQuestion.key]: value,
                      ...(drainQuestion.key === "location"
                        ? {
                            locationDetail:
                              value === "other"
                                ? (input.drain?.locationDetail ?? "")
                                : undefined,
                          }
                        : {}),
                    },
                  },
                  value !== "other",
                )
              }
            >
              {label}
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}
      {customLocation && (
        <div className="custom-drain-location">
          <label className="field-label" htmlFor="drain-location-detail">
            배수가 안 되는 곳
          </label>
          <input
            id="drain-location-detail"
            maxLength={80}
            value={input.drain?.locationDetail ?? ""}
            placeholder="예: 베란다 배수구, 세탁실 바닥"
            onChange={(e) =>
              onChange({
                drain: {
                  ...(input.drain ?? defaultDrain),
                  locationDetail: e.target.value,
                },
              })
            }
          />
          <p className="small">
            주소·동호수·연락처는 적지 마세요. 위치를 적고 다음을 눌러주세요.
          </p>
        </div>
      )}
      {input.issue === "drain" && step === 10 && (
        <p className="notice">
          약품을 사용한 뒤에는 압축기나 제거 도구를 쓰지 마세요. 제품명·사용
          시점은 마지막 설명란에 적을 수 있어요.
        </p>
      )}
      {input.issue === "drain" && step === 11 && (
        <p className="small">
          가장 최근에 해본 조치를 골라주세요. 이미 해본 방법을 반복해서 권하지
          않도록 확인해요.
        </p>
      )}
      {step === 0 && (
        <>
          <div className="choices" role="group" aria-label="지금 보이는 증상">
            {observations[input.issue].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`choice ${input.observation === value ? "selected" : ""}`}
                aria-pressed={input.observation === value}
                onClick={() => choose({ observation: value }, true)}
              >
                {label}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="small quiet-note">{issueGuidance[input.issue].note}</p>
        </>
      )}
      {step === 1 && (
        <>
          {choices("discovered", "처음 발견한 시점")}
          {choices("preexisting", "입주 당시에도 있었나요?")}
        </>
      )}
      {step === 2 && (
        <>
          {input.issue === "mold" && (
            <p className="small">
              벽·천장·창문은 원래 있던 시설, 직접 가져온 가구는 제가 설치한
              시설을 선택해요.
            </p>
          )}
          {choices(
            "installed",
            input.issue === "fixture"
              ? "문제가 있는 제품의 제공 주체"
              : "문제가 있는 시설",
            true,
          )}
        </>
      )}
      {step === 3 && (
        <>
          <fieldset>
            <legend>알고 있는 원인</legend>
            <div className="choices">
              {options.cause.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={`choice ${input.cause === value ? "selected" : ""}`}
                  aria-pressed={input.cause === value}
                  onClick={() =>
                    choose(
                      {
                        cause: value,
                        causeSource: "unknown",
                        ...(value === "unknown"
                          ? { otherClaim: "unknown" as const }
                          : {}),
                      },
                      value === "unknown",
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {input.cause !== "unknown" && (
            <>
              {choices("causeSource", "누구에게 들었나요?")}
              <details
                open={
                  !["none", "unknown"].includes(input.otherClaim)
                    ? true
                    : undefined
                }
              >
                <summary>집주인이 다른 원인을 주장했어요</summary>
                {choices("otherClaim", "집주인이 말한 다른 원인")}
              </details>
            </>
          )}
        </>
      )}
      {step === 4 &&
        choices("contact", "집주인·관리 담당자에게 연락한 상태", true)}
      {step === 5 && choices("safety", "지금 확인되는 위험 신호", true)}
      {step === 6 && (
        <>
          {!danger && <BuildingLookup input={input} onChange={onChange} />}
          <label className="field-label" htmlFor="description">
            추가로 설명할 내용 <span>선택</span>
          </label>
          <textarea
            id="description"
            maxLength={1000}
            rows={6}
            value={input.description}
            placeholder={`${descriptionHints[input.issue]}\n집주인이 답했다면 실제 답변과 요구한 내용을 적어주세요. 점검 결과·수리 약정도 함께 적을 수 있어요.`}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <p className="small field-help">
            주소·연락처·주민번호·계좌번호는 적지 마세요.
            <span>{input.description.length}/1000</span>
          </p>
          <p className="small quiet-note">
            적어주신 설명은 선택한 답변과 함께 정리해요. 원인이나 비용 부담이
            확정된 사실로 취급하지 않아요.
          </p>
        </>
      )}
      {sensitive && (
        <p className="notice" role="status">
          개인정보로 보이는 일부 내용은 분석 전에 가려져요. 탐지가 완벽하지
          않으니 직접 확인해 주세요.
        </p>
      )}
      {danger && <SafetyNotice />}
      <div className="actions sticky-actions question-actions">
        <Button disabled={danger || emptyLocation} onClick={() => onNext()}>
          {danger
            ? "위험 신호가 있어 진행을 중단했어요"
            : step === 6
              ? "입력한 내용 확인하기"
              : "다음"}
        </Button>
      </div>
    </div>
  );
}
