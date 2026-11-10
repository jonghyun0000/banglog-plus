import { it, expect, vi, afterEach } from "vitest";
import { buildingSchema, buildingQuestions } from "../shared/building";
import { intakeSchema, defaultIntake } from "../shared/schema";
import { makeAnalysis } from "../shared/analysis";
import { lookupBuilding } from "../server/building";
import { createApp } from "../server/routes/app";
import { loadConfig } from "../server/config";
afterEach(() => vi.unstubAllGlobals());
const building = buildingSchema.parse({
  use: "공동주택",
  structure: "철근콘크리트구조",
  approval: "19921014",
  floors: 15,
  checkedAt: "2026-11-05T00:00:00.000Z",
});
it("keeps old intakes compatible and includes building facts without address", () => {
  expect(intakeSchema.parse(defaultIntake).building).toBeUndefined();
  const i = intakeSchema.parse({ ...defaultIntake, building });
  expect(
    makeAnalysis(
      i,
      "00000000-0000-4000-8000-000000000001",
      "mock",
      "mock",
    ).userReportedFacts.find((f) => f.key === "building")?.value,
  ).toContain("승인일은 설비 연식");
  expect(
    buildingSchema.safeParse({ ...building, address: "private" }).success,
  ).toBe(false);
  expect(buildingQuestions(building, "drain").repair).toContain("20년");
  expect(
    buildingQuestions(
      { ...building, approval: "", floors: 1, use: "단독주택" },
      "drain",
    ).manager,
  ).toBe(false);
});
it("encodes key once, retains all buildings per page and strips addresses", async () => {
  const call = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        response: {
          header: { resultCode: "00" },
          body: {
            totalCount: 34,
            items: {
              item: [
                {
                  bldNm: "A",
                  dongNm: "101동",
                  mainPurpsCdNm: "공동주택",
                  useAprDay: "19921014",
                  grndFlrCnt: 15,
                  platPlc: "private",
                },
                { bldNm: "B", useAprDay: "" },
              ],
            },
          },
        },
      }),
    ),
  );
  vi.stubGlobal("fetch", call);
  const r = await lookupBuilding("test%2Bkey%3D", {
    code: "1168010300",
    bun: "12",
    ji: "0",
    mountain: false,
    page: 2,
  });
  expect(r.items).toHaveLength(2);
  expect(r.total).toBe(34);
  const u = new URL(call.mock.calls[0][0]);
  expect(u.searchParams.get("serviceKey")).toBe("test+key=");
  expect(u.searchParams.get("bun")).toBe("0012");
  expect(u.searchParams.get("pageNo")).toBe("2");
  expect(JSON.stringify(r)).not.toContain("private");
});
it("returns safe errors and rejects invalid lookup parameters", async () => {
  const { app } = createApp({ config: loadConfig({}) });
  const r = await app.inject({
    method: "POST",
    url: "/api/buildings",
    payload: { code: "1168010300", bun: "12", ji: "0", mountain: false },
  });
  expect(r.statusCode).toBe(503);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/buildings",
        payload: { code: "x" },
      })
    ).statusCode,
  ).toBe(400);
  await app.close();
});

it("fixed building guidance covers all repair and contact answers without assigning liability", async () => {
  const { makeFallback } = await import("../shared/fallback");
  for (const repairHistory of ["yes", "no", "unknown"] as const) {
    for (const manager of ["yes", "no", "unknown"] as const) {
      const input = {
        ...defaultIntake,
        building: { ...building, repairHistory, manager },
      };
      const result = makeAnalysis(
        input,
        "00000000-0000-4000-8000-000000000001",
        "live",
        "test",
      );
      expect(result.buildingGuide?.recipient).toBe(
        manager === "yes" ? "manager" : "landlord",
      );
      expect(result.repairRequest.recipient).toBe(
        result.buildingGuide?.recipient,
      );
      expect(result.costResponsibility.direction).toBe("undetermined");
      expect(result.buildingGuide?.repairExplanation).toBeTruthy();
      expect(
        makeFallback(input, result.analysisId, "PROVIDER_TIMEOUT")
          .buildingGuide,
      ).toEqual(result.buildingGuide);
    }
  }
  const input = {
    ...defaultIntake,
    building: { ...building, manager: "yes" as const },
    issue: "fixture" as const,
    installed: "own" as const,
  };
  expect(
    makeAnalysis(input, "00000000-0000-4000-8000-000000000001", "mock", "test")
      .buildingGuide?.recipient,
  ).toBe("service");
  expect(
    makeAnalysis(
      { ...input, safety: "electric" },
      "00000000-0000-4000-8000-000000000001",
      "mock",
      "test",
    ).buildingGuide,
  ).toBeUndefined();
});

it("drain contact step follows known manager availability", () => {
  const result = makeAnalysis(
    {
      ...defaultIntake,
      issue: "drain",
      building: { ...building, manager: "yes" },
      drain: {
        location: "basin",
        scope: "single",
        overflow: "no",
        chemical: "no",
        attempted: "none",
      },
      safety: "none",
      preexisting: "no",
      observation: "slow-drain",
    },
    "00000000-0000-4000-8000-000000000001",
    "mock",
    "test",
  );
  expect(result.drainGuide?.steps[1].title).toContain("관리 담당자");
  expect(result.repairRequest.recipient).toBe("manager");
});

it("contact drafts follow recipient and repair history without inventing repairs", async () => {
  const { makeFallback } = await import("../shared/fallback");
  for (const manager of ["yes", "no", "unknown"] as const) {
    for (const repairHistory of ["yes", "no", "unknown"] as const) {
      const input = {
        ...defaultIntake,
        building: { ...building, manager, repairHistory },
      };
      const result = makeAnalysis(
        input,
        "00000000-0000-4000-8000-000000000001",
        "mock",
        "test",
      );
      expect(result.messageDraft.includes("관리 담당자님")).toBe(
        manager === "yes",
      );
      expect(result.messageDraft).toContain(
        manager === "yes" ? "집주인과도 공유" : "방문 일정을 안내",
      );
      expect(result.messageDraft).toContain(
        {
          yes: "알고 있는 내용을 함께 전달",
          no: "제가 알고 있는 해당 부위의 교체·수리 이력은 없습니다",
          unknown: "이력은 아직 확인하지 못했습니다",
        }[repairHistory],
      );
      expect(result.messageDraft).not.toMatch(
        /재발했습니다|지난달|2023|제 과실/,
      );
      expect(
        makeFallback(input, result.analysisId, "PROVIDER_TIMEOUT").messageDraft,
      ).toBe(result.messageDraft);
    }
  }
});
