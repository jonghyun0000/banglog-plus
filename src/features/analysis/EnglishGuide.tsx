import { useLanguage } from "../../app/language";
import type { Analysis, Intake } from "../../../shared/schema";
import { intakeIssueName } from "../../../shared/schema";
import { observationLabel, repairGuidance } from "../../../shared/questions";
import { isLightingIssue } from "../../../shared/lighting";
import { Button } from "../../components/ui/Elements";
import { SafetyNotice } from "../questions/Questions";

export const englishRecipients = {
  landlord: "landlord",
  manager: "building manager",
  service: "repair provider",
  emergency: "emergency services",
} as const;

const englishActions: Record<Intake["issue"], string> = {
  mold: "Photograph the affected area and note when it appears. Ask for an inspection of possible moisture sources before repainting.",
  leak: "Keep clear of water near electrical equipment. Record where and when the water appeared, and ask for a prompt inspection.",
  boiler:
    "Record any error code and which function stopped working. Ask for an inspection and keep the findings and itemized quote.",
  surface:
    "Compare the affected area with your move-in records. Ask whether spot repair is possible and why any wider work is needed.",
  drain:
    "Report which drains are affected and what you already tried. Ask for an inspection.",
  fixture:
    "Record the model and the symptoms. Check who provided the item and ask for the inspection findings and repair scope.",
};

export function EnglishGuide({
  result,
  intake,
  onMessage,
  onEdit,
  onSave,
  onRepair,
}: {
  result: Analysis;
  intake: Intake;
  onMessage: () => void;
  onEdit: () => void;
  onSave: () => void;
  onRepair: () => void;
}) {
  const { t } = useLanguage();
  if (result.status === "safety_priority")
    return (
      <>
        <h1 tabIndex={-1}>Get to safety first</h1>
        <SafetyNotice />
      </>
    );
  if (result.status === "out_of_scope" || result.status === "failed")
    return (
      <>
        <h1 tabIndex={-1}>We can’t provide a guide for this request</h1>
        <p>This guide covers home repairs in South Korean rentals.</p>
        <Button onClick={onEdit}>Review my answers</Button>
      </>
    );
  const lighting = isLightingIssue(intake);
  const action = lighting
    ? t(repairGuidance(intake).record)
    : englishActions[intake.issue];
  const drain = result.drainGuide;
  const plan =
    result.mode === "live" &&
    !result.fallback &&
    result.responseLanguage === "en"
      ? result.tailoredResponse
      : undefined;
  return (
    <>
      <h1 tabIndex={-1}>{t(intakeIssueName(intake))} repair guide</h1>
      <p>{t(observationLabel(intake))}</p>
      {result.fallback ? (
        <p className="notice">
          {result.fallback.reason.startsWith("KNOWLEDGE_")
            ? "We couldn’t verify enough sources for this situation. Here’s the basic repair guide."
            : "GPT couldn’t complete this request. Here’s the basic repair guide."}
        </p>
      ) : !plan ? (
        <p className="small">Basic repair guidance based on your answers.</p>
      ) : null}
      <section className="result-card" aria-labelledby="english-next-action">
        <h2 id="english-next-action">What to do next</h2>
        {drain ? (
          <ol>
            {drain.steps.map((step) => (
              <li key={step.title}>
                <strong>
                  {t(step.title) === step.title
                    ? "Contact and inspection"
                    : t(step.title)}
                </strong>
                <p>
                  {t(step.body) === step.body
                    ? englishActions.drain
                    : t(step.body)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p>{action}</p>
        )}
        {lighting && (
          <ul>
            {repairGuidance(intake).checks.map((check) => (
              <li key={check}>{t(check)}</li>
            ))}
          </ul>
        )}
      </section>
      {plan && (
        <section
          className="result-card tailored-response"
          aria-labelledby="english-gpt-guidance"
        >
          <h2 id="english-gpt-guidance">
            GPT guidance based on verified sources
          </h2>
          <p>{result.aiExplanation}</p>
          <p>{plan.summary}</p>
          <ol className="response-steps">
            {plan.steps.map((step, index) => (
              <li key={index}>
                <h3>{step.title}</h3>
                <p>{step.action}</p>
                {step.missingEvidence.length > 0 && (
                  <div className="notice">
                    <strong>What to gather</strong>
                    <ul>
                      {step.missingEvidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="response-evidence">
                  <h4>Legal basis and limits</h4>
                  <p>{step.reason}</p>
                  {step.citations.map((citation) => {
                    const source = result.sources.find(
                      (item) =>
                        item.id === citation.sourceId &&
                        item.version === citation.sourceVersion,
                    );
                    return (
                      source && (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Read the Korean original{" "}
                          <span lang="ko">· {source.title}</span>
                        </a>
                      )
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="result-card">
        <h2>Who to contact</h2>
        <p>Contact your {englishRecipients[result.repairRequest.recipient]}.</p>
        <h2>Discussing costs</h2>
        <p>
          Keep a copy of the inspection and quote. Check the repair scope and
          any relevant lease terms before agreeing on costs.
        </p>
      </section>
      <Button onClick={onMessage}>Edit and copy a repair message</Button>
      <div className="actions">
        <Button secondary onClick={onSave}>
          Save to My records
        </Button>
        <Button secondary onClick={onRepair}>
          Add to repair log
        </Button>
        <Button secondary onClick={onEdit}>
          {result.mode === "live" && !plan && result.aiExplanation
            ? "Review answers for English GPT guidance"
            : "Edit answers"}
        </Button>
      </div>
    </>
  );
}
