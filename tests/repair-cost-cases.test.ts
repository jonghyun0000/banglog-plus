import { expect, test } from "vitest";
import { defaultDrain, defaultIntake } from "../shared/schema";
import {
  repairCostCases,
  repairCostPreview,
} from "../src/features/analysis/repair-cost-cases";

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
  expect(repairCostCases(input, "complete").map((item) => item.title)).toEqual([
    "아파트 싱크대 배관 막힘 제거",
    "싱크대 단순 막힘 제거",
  ]);
  expect(
    repairCostCases({ ...input, observation: "backflow" }, "complete").map(
      (item) => item.title,
    ),
  ).toEqual([
    "싱크대 반복 막힘·역류 배관 작업",
    "싱크대 역류와 배관 경사 보완",
  ]);
  expect(
    repairCostCases(
      { ...input, drain: { ...input.drain, scope: "multiple" } },
      "complete",
    ).map((item) => item.title),
  ).toEqual(["원룸 건물의 주방·욕실 연결 배관 청소"]);
  expect(
    repairCostCases(
      { ...input, drain: { ...input.drain, scope: "unknown" } },
      "complete",
    ),
  ).toEqual([]);
});

test("wallpaper and flooring show only matching partial repair work", () => {
  const surface = { ...defaultIntake, issue: "surface" as const };
  const wall = repairCostCases(
    { ...surface, observation: "wall-dent" },
    "complete",
  );
  expect(wall).toHaveLength(6);
  expect(wall).toContainEqual(
    expect.objectContaining({
      priceLabel: "의뢰 게시 금액",
      referencePrice: "건당 15만 원",
    }),
  );
  expect(wall.every((item) => item.groups.includes("wallpaper-patch"))).toBe(
    true,
  );
  const floor = repairCostCases(
    { ...surface, observation: "floor-tear" },
    "complete",
  );
  expect(floor).toContainEqual(
    expect.objectContaining({ referencePrice: "5만~15만 원" }),
  );
  expect(floor.every((item) => item.groups.includes("flooring-patch"))).toBe(
    true,
  );
  expect(repairCostCases(surface, "complete")).toEqual([]);
});

test("the upper price summary uses comparable portfolio budgets without mixing in quotes", () => {
  const boiler = repairCostCases(
    { ...defaultIntake, issue: "boiler", observation: "hotwater" },
    "needs_information",
  );
  expect(boiler).toHaveLength(2);
  expect(
    repairCostCases(
      { ...defaultIntake, issue: "boiler", observation: "heating" },
      "complete",
    ),
  ).toHaveLength(4);
  expect(repairCostPreview(boiler)).toMatchObject({
    label: "시공 사례 공개 예산",
    amount: "50만~75만 원",
    action: "2건 보기",
  });
  const fixture = { ...defaultIntake, issue: "fixture" as const };
  expect(
    repairCostCases({ ...fixture, observation: "aircon" }, "complete"),
  ).toEqual([
    expect.objectContaining({ publishedBudget: 230000 }),
    expect.objectContaining({ publishedBudget: 500000 }),
  ]);
  const washer = repairCostCases(
    { ...fixture, observation: "washer" },
    "complete",
  );
  expect(washer).toEqual([]);
  expect(repairCostPreview(washer)).toBeNull();
});

test("safety, active overflow and unsupported requests suppress the cost section", () => {
  for (const status of ["safety_priority", "out_of_scope", "failed"] as const)
    expect(
      repairCostCases({ ...defaultIntake, observation: "wall" }, status),
    ).toEqual([]);
  expect(
    repairCostCases(
      {
        ...defaultIntake,
        issue: "drain",
        drain: { ...defaultDrain, overflow: "yes" },
      },
      "complete",
    ),
  ).toEqual([]);
});
