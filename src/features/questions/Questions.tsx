import { BuildingLookup } from "./BuildingLookup";
import {
  drainQuestions,
  drainOptions,
  questionSteps,
} from "../../../shared/drain";
import { useState } from "react";
import {
  defaultDrain,
  intakeIssueName,
  repairScopeLabels,
  repairScopeSchema,
  type Intake,
} from "../../../shared/schema";
import {
  isLightingIssue,
  lightingQuestion,
  lightingStep,
  lightingTypes,
} from "../../../shared/lighting";
import {
  options,
  titles,
  descriptionHint,
  observationChoices,
  repairGuidance,
  emptyDetails,
  hasReply,
  applyQuestionPatch,
  repairStageLabels,
} from "../../../shared/questions";
import {
  hasDanger,
  safetyText,
  safetyUrl,
  maskPersonalData,
} from "../../../shared/safety";
import {
  Button,
  Choice,
  ChoiceButton,
  SectionTitle,
} from "../../components/ui/Elements";
export function SafetyNotice() {
  return (
    <aside className="safety-notice" aria-label="안전 안내">
      <div role="alert">
        <strong>지금은 안전 확인이 먼저예요</strong>
        <p>{safetyText}</p>
      </div>
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
    if (advance && autoAdvance && !hasDanger(applyQuestionPatch(input, patch)))
      onNext(patch);
  }
  function choices(key: keyof typeof options, legend: string, quick = false) {
    return (
      <fieldset
        className={step === 1 || step === 4 ? "compact-answers" : undefined}
      >
        <legend>{legend}</legend>
        <div className="choices">
          {options[key]
            .filter(
              ([value]) =>
                key !== "causeSource" ||
                ((value !== "technician" ||
                  input.details?.inspection === "yes") &&
                  (value !== "landlord" || hasReply(input))),
            )
            .map(([value, label]) =>
              quick ? (
                <ChoiceButton
                  key={value}
                  label={label}
                  selected={input[key] === value}
                  onClick={() =>
                    choose(
                      { [key]: value },
                      key !== "safety" ||
                        !["gas", "fire", "electric"].includes(value),
                    )
                  }
                />
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
  const phase = step === 0 || step === 5 ? 1 : step === 6 ? 3 : 2;
  const details = input.details ?? emptyDetails;
  function updateDetails(patch: Partial<typeof details>) {
    onChange({ details: { ...details, ...patch } });
  }
  const customLocation = step === 7 && input.drain?.location === "other";
  const emptyLocation = customLocation && !input.drain?.locationDetail?.trim();
  const missingLightingType = step === lightingStep && !input.lighting;
  return (
    <div className="question-screen">
      <div className="question-context">
        <span>{intakeIssueName(input)}</span>
        <span>
          {phase} / 3 · {["증상·안전", "상황 확인", "자료·검토"][phase - 1]}
        </span>
      </div>
      <progress
        className="question-progress"
        value={phase}
        max={3}
        aria-label="질문 진행 상황"
      />
      <SectionTitle
        title={
          step === 2 && input.issue === "mold"
            ? "문제가 생긴 곳은 어떤 시설인가요?"
            : step === lightingStep
              ? lightingQuestion
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
            <ChoiceButton
              key={value}
              label={label}
              selected={
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
            />
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
            {observationChoices(input).map(([value, label]) => (
              <ChoiceButton
                key={value}
                label={label}
                selected={input.observation === value}
                onClick={() => choose({ observation: value }, true)}
              />
            ))}
          </div>
          <p className="small quiet-note">{repairGuidance(input).note}</p>
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
            input.issue === "fixture" && !isLightingIssue(input)
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
                <ChoiceButton
                  key={value}
                  label={label}
                  selected={input.cause === value}
                  onClick={() =>
                    choose(
                      {
                        cause: value,
                        causeSource: "unknown",
                      },
                      false,
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          {input.cause !== "unknown" &&
            choices("causeSource", "누구에게 들었나요?")}
          {details.inspection === "yes" && (
            <label className="field-label">
              기사에게 들은 소견 (선택)
              <textarea
                value={details.technicianNote}
                maxLength={320}
                onChange={(e) =>
                  updateDetails({ technicianNote: e.target.value })
                }
              />
            </label>
          )}
          {hasReply(input) && (
            <details
              open={
                Boolean(details.reply) ||
                !["unknown", "none"].includes(input.otherClaim)
              }
            >
              <summary>집주인·관리 담당자 답변 추가</summary>
              <label className="field-label">
                상대방 답변 (선택)
                <textarea
                  value={details.reply}
                  maxLength={320}
                  onChange={(e) => updateDetails({ reply: e.target.value })}
                />
              </label>
              {choices("otherClaim", "집주인이 말한 다른 원인")}
            </details>
          )}
        </>
      )}
      {step === 4 && (
        <>
          <label className="field-label">
            수리 기사에게 점검받았나요?
            <select
              value={details.inspection}
              onChange={(e) =>
                updateDetails({
                  inspection: e.target.value as typeof details.inspection,
                })
              }
            >
              <option value="unknown">아직 선택하지 않았어요</option>
              <option value="no">점검받지 않았어요</option>
              <option value="yes">점검받았어요</option>
            </select>
          </label>
          {choices("contact", "집주인·관리 담당자에게 연락한 상태", true)}
        </>
      )}
      {step === 5 && choices("safety", "지금 확인되는 위험 신호", true)}
      {step === lightingStep && (
        <div className="choices" role="group" aria-label="조명 형태">
          {lightingTypes.map(([value, label]) => (
            <ChoiceButton
              key={value}
              label={label}
              selected={input.lighting === value}
              onClick={() => choose({ lighting: value }, true)}
            />
          ))}
        </div>
      )}
      {step === 6 && (
        <>
          {isLightingIssue(input) && (
            <fieldset className="lighting-work-fields">
              <legend>고장 난 조명과 작업 범위 (선택)</legend>
              <label className="field-label">
                고장 위치
                <input
                  type="text"
                  maxLength={120}
                  placeholder="예: 거실 천장 가운데 등"
                  value={details.location}
                  onChange={(e) => updateDetails({ location: e.target.value })}
                />
              </label>
              <label className="field-label">
                고장 난 조명 개수
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={input.lightingWork?.count ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^[1-9]\d{0,2}$/.test(value))
                      onChange({
                        lightingWork: {
                          ...input.lightingWork,
                          count: value ? Number(value) : undefined,
                        },
                      });
                  }}
                />
              </label>
              <label className="field-label">
                어떤 작업을 안내받았나요?
                <select
                  value={input.lightingWork?.scope ?? ""}
                  onChange={(e) =>
                    onChange({
                      lightingWork: {
                        ...input.lightingWork,
                        scope: repairScopeSchema.safeParse(e.target.value).data,
                      },
                    })
                  }
                >
                  <option value="">안내받은 작업 없음</option>
                  {repairScopeSchema.options.map((scope) => (
                    <option key={scope} value={scope}>
                      {repairScopeLabels[scope]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          {!danger && <BuildingLookup input={input} onChange={onChange} />}
          <details>
            <summary>발견 기록·계약 특약 (선택)</summary>
            <label className="field-label">
              수리 진행 상태 (선택)
              <select
                value={input.repairStage ?? ""}
                onChange={(e) =>
                  onChange({
                    repairStage:
                      e.target.value === "before" || e.target.value === "after"
                        ? e.target.value
                        : undefined,
                  })
                }
              >
                <option value="">선택 안 함</option>
                <option value="before">{repairStageLabels.before}</option>
                <option value="after">{repairStageLabels.after}</option>
              </select>
            </label>
            {!isLightingIssue(input) && (
              <label className="field-label">
                문제 위치 (선택)
                <input
                  maxLength={120}
                  value={details.location}
                  onChange={(e) => updateDetails({ location: e.target.value })}
                />
              </label>
            )}
            <label className="field-label">
              발견 시각 (선택)
              <input
                type="datetime-local"
                value={details.discoveredAt}
                onChange={(e) =>
                  updateDetails({ discoveredAt: e.target.value })
                }
              />
            </label>
            <label className="field-label">
              사용에 지장이 생긴 부분 (선택)
              <textarea
                maxLength={240}
                value={details.impact}
                onChange={(e) => updateDetails({ impact: e.target.value })}
              />
            </label>
            <label className="field-label">
              관련 계약 특약 (선택)
              <textarea
                maxLength={300}
                value={input.contract}
                onChange={(e) => onChange({ contract: e.target.value })}
              />
            </label>
          </details>
          <label className="field-label" htmlFor="description">
            추가로 설명할 내용 <span>선택</span>
          </label>
          <textarea
            id="description"
            maxLength={1000}
            rows={6}
            value={input.description}
            placeholder={`${descriptionHint(input)}\n그 밖에 확인이 필요한 내용을 적을 수 있어요.`}
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
        <Button
          disabled={danger || emptyLocation || missingLightingType}
          onClick={() => onNext()}
        >
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
