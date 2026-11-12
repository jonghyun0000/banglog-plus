import { repairMessage } from "../../shared/analysis";
import { isLightingIssue } from "../../shared/lighting";
import { observationLabel } from "../../shared/questions";
import {
  intakeIssueName,
  repairScopeLabels,
  type Analysis,
  type Intake,
} from "../../shared/schema";
import { english } from "./english";
import type { Language } from "./language";

export function localizedRepairMessage(
  input: Intake,
  recipient: Analysis["repairRequest"]["recipient"],
  kind: Analysis["messageKind"],
  language: Language,
) {
  const original = repairMessage(input, recipient, kind);
  if (language === "ko" || !original) return original;
  const label = (value: string) => english[value] ?? value;
  const subject = label(intakeIssueName(input)).toLowerCase();
  const repaired = input.repairStage === "after";
  const contacted = ["waiting", "cost", "replied"].includes(input.contact);
  const scope = input.lightingWork?.scope;
  return [
    repaired
      ? `Hello, I’m writing to confirm what work was carried out for the ${subject}.`
      : kind === "followup" && contacted
        ? `Hello, I’m following up about the ${subject}.`
        : `Hello, I’m writing about a ${subject} issue in my rental.`,
    !["unknown", "light-unknown"].includes(input.observation) &&
      `What I noticed: ${label(observationLabel(input))}.`,
    input.details?.location && `Affected area: ${input.details.location}`,
    input.drain &&
      `Drain location: ${input.drain.location === "other" ? input.drain.locationDetail || "other" : { basin: "bathroom sink", sink: "kitchen sink", floor: "floor drain", toilet: "toilet", unknown: "unknown" }[input.drain.location]}.`,
    input.drain?.attempted === "cleaned" &&
      "I cleared the visible debris, but the problem persists.",
    input.drain?.chemical === "yes" &&
      "I used a drain chemical and can provide the product name and time before the inspection.",
    input.lightingWork?.count &&
      `Number of affected lights: ${input.lightingWork.count}.`,
    scope &&
      scope !== "unknown" &&
      `The work suggested was: ${label(repairScopeLabels[scope])}.`,
    repaired
      ? "Could you share the actual work performed and the itemized costs, together with any receipt or inspection record?"
      : "Could you confirm the inspection schedule and the proposed work, with an itemized quote if available?",
    isLightingIssue(input) &&
      !repaired &&
      "Can the affected part be repaired on its own? If full replacement is necessary, could you explain why and itemize parts, labor and the call-out fee?",
    input.contract.trim() &&
      recipient !== "service" &&
      "Could you also explain which part of the lease applies to the proposed work?",
    "I’d like to review the findings and discuss the costs with you. Thank you.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}
