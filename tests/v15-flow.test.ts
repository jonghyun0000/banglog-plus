import { expect, it } from "vitest";
import { applyQuestionPatch, emptyDetails } from "../shared/questions";
import { makeAnalysis, repairMessage } from "../shared/analysis";
import { questionSteps } from "../shared/drain";
import { defaultIntake, intakeSchema } from "../shared/schema";
import { hasDanger, sanitizeIntake } from "../shared/safety";
import { newRepair, repairSchema } from "../shared/repair";
import {
  mergeRepairGuide,
  prepareRepairFollowup,
} from "../shared/repair-guide";

it("clears hidden contact answers while keeping independent technician details", () => {
  const input = intakeSchema.parse({
    ...defaultIntake,
    cause: "aging",
    causeSource: "technician",
    contact: "cost",
    otherClaim: "damage",
    details: {
      ...emptyDetails,
      inspection: "yes",
      technicianNote: "밸브 점검 필요",
      reply: "비용 부담 요청",
    },
  });
  const noContact = applyQuestionPatch(input, { contact: "no" });
  expect(noContact).toMatchObject({
    cause: "aging",
    causeSource: "technician",
    otherClaim: "unknown",
    details: { reply: "", technicianNote: "밸브 점검 필요" },
  });
  expect(questionSteps(noContact)).toContain(3);
  const noInspection = applyQuestionPatch(noContact, {
    details: { ...noContact.details!, inspection: "no" },
  });
  expect(noInspection).toMatchObject({
    cause: "unknown",
    causeSource: "unknown",
    details: { technicianNote: "" },
  });
  expect(questionSteps(noInspection)).not.toContain(3);
});

it("keeps discovered time and unverified reports distinct and never invents a paid or sent event", () => {
  const input = {
    ...defaultIntake,
    details: { ...emptyDetails, discoveredAt: "2026-11-11T08:00" },
  };
  for (const kind of ["initial", "cost", "followup"] as const) {
    const text = repairMessage(input, "manager", kind);
    expect(text).toContain("관리 담당자님");
    expect(text).toContain("제가 발견한 시각은 2026-11-11 08:00");
    expect(text).not.toMatch(
      /발생한 시각|첨부합니다|지출했습니다|거절하셨|앞서 연락드린|기사에게 들은/,
    );
  }
});

it("links without overwriting the local record and sends only selected additional reports", () => {
  const old = newRepair();
  const {
    guides: _guides,
    inspectionQuestions: _questions,
    inspectionAnswers: _answers,
    itemizedCost: _cost,
    ...legacy
  } = old;
  expect(repairSchema.parse(legacy).guides).toEqual([]);
  const input = {
    ...defaultIntake,
    details: { ...emptyDetails, location: "부엌" },
  };
  const result = makeAnalysis(
    input,
    "00000000-0000-4000-8000-000000000001",
    "mock",
    "test",
  );
  const linked = mergeRepairGuide(
    { ...old, location: "기존 위치", paidAmount: "123456" },
    { intake: input, result, draft: "초안 전용" },
    ["cost"],
  );
  expect(linked).toMatchObject({
    location: "기존 위치",
    contacts: [],
    paidAmount: "123456",
    inspectionQuestions: ["cost"],
  });
  expect(linked.guides).toHaveLength(1);
  const next = prepareRepairFollowup(
    linked,
    "밸브 점검 010-1234-5678",
    "점검 가능하다고 답함",
  )!;
  expect(next.details).toMatchObject({
    technicianNote: "밸브 점검 [연락처 가림]",
    reply: "점검 가능하다고 답함",
  });
  expect(next).toMatchObject({
    contact: "replied",
    cause: "unknown",
    causeSource: "unknown",
  });
  expect(JSON.stringify(next)).not.toMatch(
    /123456|초안 전용|guides|attachments/,
  );
  const nextResult = makeAnalysis(
    next,
    "00000000-0000-4000-8000-000000000002",
    "mock",
    "test",
  );
  expect(nextResult.userReportedFacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "사용자가 전한 기사 소견",
        provenance: "relayed_technician",
      }),
      expect.objectContaining({
        key: "사용자가 전한 상대방 답변",
        provenance: "landlord_claim",
      }),
    ]),
  );
  expect(
    mergeRepairGuide(
      linked,
      { intake: next, result: nextResult, draft: "" },
      [],
    ).guides.map((g) => g.result.analysisId),
  ).toEqual([result.analysisId, nextResult.analysisId]);
  expect(
    hasDanger(
      sanitizeIntake({
        ...next,
        details: { ...next.details!, technicianNote: "가스 냄새" },
      }),
    ),
  ).toBe(true);
});
