import { expect, test } from "vitest";
import { defaultDrain, defaultIntake } from "../shared/schema";
import { repairCostCases } from "../src/features/analysis/repair-cost-cases";

test("single sink, sink backflow and multiple drains use different work scopes", () => {
  const input = {
    ...defaultIntake,
    issue: "drain" as const,
    observation: "slow-drain" as const,
    drain: {
      ...defaultDrain,
      location: "sink" as const,
      scope: "single" as const,
    },
  };
  expect(repairCostCases(input, "complete")?.map((item) => item.title)).toEqual(
    ["아파트 싱크대 배관 막힘 제거"],
  );
  expect(
    repairCostCases({ ...input, observation: "backflow" }, "complete")?.map(
      (item) => item.publishedBudget,
    ),
  ).toEqual([300000, 250000]);
  expect(
    repairCostCases(
      { ...input, drain: { ...input.drain, scope: "multiple" } },
      "complete",
    )?.map((item) => item.title),
  ).toEqual(["원룸 건물의 주방·욕실 연결 배관 청소"]);
  expect(
    repairCostCases(
      { ...input, drain: { ...input.drain, scope: "unknown" } },
      "complete",
    ),
  ).toEqual([]);
});

test("work examples are specific to the selected finish or appliance", () => {
  const surface = { ...defaultIntake, issue: "surface" as const };
  expect(
    repairCostCases({ ...surface, observation: "wall-dent" }, "complete")?.map(
      (item) => item.publishedBudget,
    ),
  ).toEqual([330000]);
  expect(
    repairCostCases({ ...surface, observation: "floor-tear" }, "complete")?.map(
      (item) => item.publishedBudget,
    ),
  ).toEqual([1100000]);
  const fixture = { ...defaultIntake, issue: "fixture" as const };
  expect(
    repairCostCases({ ...fixture, observation: "aircon" }, "complete")?.map(
      (item) => item.publishedBudget,
    ),
  ).toEqual([230000, 500000]);
  expect(
    repairCostCases({ ...fixture, observation: "washer" }, "complete"),
  ).toEqual([]);
});

test("safety, active overflow and unsupported requests suppress the cost section", () => {
  for (const status of ["safety_priority", "out_of_scope", "failed"] as const)
    expect(repairCostCases(defaultIntake, status)).toBeNull();
  expect(
    repairCostCases(
      {
        ...defaultIntake,
        issue: "drain",
        drain: { ...defaultDrain, overflow: "yes" },
      },
      "complete",
    ),
  ).toBeNull();
});
