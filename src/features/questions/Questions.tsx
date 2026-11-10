import { useEffect, useRef } from "react";
import type { Intake } from "../../../shared/schema";
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
        국민안전24 전기·가스 사고 행동요령 ↗
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
  onNext: () => void;
}) {
  function choices(key: keyof typeof options, legend: string) {
    return (
      <fieldset>
        <legend>{legend}</legend>
        <div className="choices">
          {options[key].map(([value, label]) => (
            <Choice
              key={value}
              value={value}
              label={label}
              current={input[key]}
              onChange={(v) => onChange({ [key]: v })}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  const danger = hasDanger(input);
  const safetyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (danger) safetyRef.current?.scrollIntoView({ block: "start" });
  }, [danger]);
  const sensitive =
    maskPersonalData(input.description) !== input.description ||
    maskPersonalData(input.contract) !== input.contract;
  return (
    <>
      <SectionTitle
        eyebrow={`상황 확인 · ${step + 1} / ${titles.length}`}
        title={
          step === 3 && input.issue === "mold"
            ? "어느 부분에 생겼나요?"
            : step === 3 && input.issue === "fixture"
              ? "누가 제공한 제품인가요?"
              : titles[step]
        }
      >
        <p>
          {step === 0
            ? "보이는 증상만 적어주세요. 원인을 몰라도 괜찮아요."
            : step === 4
              ? "누가 설명했는지도 구분해요. 전달된 소견은 확정된 원인과 달라요."
              : step === 5
                ? "필요한 문장만 적어주세요. 모르거나 없으면 건너뛰어도 돼요."
                : "모르겠어요를 골라도 다음으로 갈 수 있어요."}
        </p>
      </SectionTitle>
      {danger && (
        <div ref={safetyRef}>
          <SafetyNotice />
        </div>
      )}
      {step === 0 && (
        <>
          <fieldset className="observation-field">
            <legend>지금 보이는 증상</legend>
            <div className="choices">
              {observations[input.issue].map(([value, label]) => (
                <Choice
                  key={value}
                  value={value}
                  label={label}
                  current={input.observation}
                  onChange={(v) =>
                    onChange({ observation: v as Intake["observation"] })
                  }
                />
              ))}
            </div>
          </fieldset>
          <p className="small field-help">{issueGuidance[input.issue].note}</p>
          <label className="field-label" htmlFor="description">
            상황 설명 <span>선택</span>
          </label>
          <textarea
            id="description"
            maxLength={1000}
            rows={4}
            value={input.description}
            placeholder={descriptionHints[input.issue]}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <p className="small field-help">
            주소·연락처·주민번호·계좌번호는 적지 마세요.{" "}
            <span>{input.description.length}/1000</span>
          </p>
          <div className="safety-field">
            <label className="field-label" htmlFor="safety">
              지금 위험 신호가 있나요?
            </label>
            <select
              id="safety"
              value={input.safety}
              onChange={(e) =>
                onChange({ safety: e.target.value as Intake["safety"] })
              }
            >
              {options.safety.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {step === 1 && choices("discovered", "처음 발견한 시점")}
      {step === 2 && choices("preexisting", "입주 당시 상태")}
      {step === 3 && (
        <>
          {input.issue === "mold" && (
            <p className="small">
              벽·천장·창문은 ‘원래 있던 시설’, 직접 가져온 가구는 ‘제가 설치한
              시설’을 선택해 주세요.
            </p>
          )}
          {input.issue === "fixture" && (
            <p className="small">
              계약서의 옵션 목록을 확인해 주세요. 직접 가져온 가전·가구는 ‘제가
              설치한 시설’을 선택해요.
            </p>
          )}
          {choices("installed", "문제가 있는 부분")}
        </>
      )}
      {step === 4 && (
        <>
          {choices("cause", "들은 설명 또는 관찰한 가능성")}
          {input.cause !== "unknown" &&
            choices("causeSource", "그 설명은 어디에서 알게 됐나요?")}
          {choices("otherClaim", "집주인에게 다른 원인 설명도 들었나요?")}
        </>
      )}
      {step === 5 && (
        <>
          <label className="field-label" htmlFor="contract">
            수리와 관련된 계약 문장 <span>선택</span>
          </label>
          <textarea
            id="contract"
            rows={4}
            maxLength={300}
            value={input.contract}
            onChange={(e) => onChange({ contract: e.target.value })}
            placeholder="계약서 전체나 이름·주소는 넣지 마세요."
          />
          <p className="small field-help">
            계약 문구만으로 비용 부담을 확정하지 않아요.{" "}
            <span>{input.contract.length}/300</span>
          </p>
        </>
      )}
      {step === 6 && choices("contact", "집주인·관리 담당자에게 연락한 상태")}
      {sensitive && (
        <p className="notice" role="status">
          개인정보로 보이는 일부 내용은 분석 전에 가려져요. 탐지가 완벽하지
          않으니 직접 확인해 주세요.
        </p>
      )}
      <div className="actions">
        <Button onClick={onNext}>
          {step === 6 ? "입력한 내용 확인하기" : "다음"}
        </Button>
      </div>
    </>
  );
}
