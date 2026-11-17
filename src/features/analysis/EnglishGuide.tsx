import { sourceLink } from "../../../shared/source-link";
import type { Analysis, Intake } from "../../../shared/schema";
import { isLightingIssue } from "../../../shared/lighting";
import { repairGuidance } from "../../../shared/questions";
import { useLanguage } from "../../app/language";
import { Button } from "../../components/ui/Elements";
import { ResultOverview, englishActions } from "./ResultOverview";

export function EnglishGuide({
  result,
  intake,
  onMessage,
  onEdit,
  onSave,
  onRepair,
  readOnly = false,
}: {
  readOnly?: boolean;
  result: Analysis;
  intake: Intake;
  onMessage: () => void;
  onEdit: () => void;
  onSave: () => void;
  onRepair: () => void;
}) {
  const { t } = useLanguage();
  const supported =
    result.status === "complete" || result.status === "needs_information";
  const lighting = isLightingIssue(intake);
  const drain = result.drainGuide;
  const plan =
    result.mode === "live" &&
    !result.fallback &&
    result.responseLanguage === "en"
      ? result.tailoredResponse
      : undefined;
  return (
    <div className="result-screen">
      <ResultOverview
        result={result}
        intake={intake}
        language="en"
        onMessage={onMessage}
        onEdit={readOnly ? undefined : onEdit}
      />
      {supported && (drain || lighting) && (
        <section className="result-card" aria-labelledby="english-next-action">
          <h2 id="english-next-action">Detailed repair steps</h2>
          {drain && (
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
          )}
          {lighting && (
            <ul>
              {repairGuidance(intake).checks.map((check) => (
                <li key={check}>{t(check)}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      {supported && plan && (
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
                          href={sourceLink(source.url)}
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
      {supported && !readOnly && (
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
      )}
    </div>
  );
}
