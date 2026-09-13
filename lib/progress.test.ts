import { describe, expect, it } from "vitest";
import { calcWeeklyProgress, calcYearlyProgress } from "./progress";

describe("calcWeeklyProgress", () => {
  it("returns 0 when there are no todos", () => {
    expect(calcWeeklyProgress([])).toBe(0);
  });

  it("returns 100 when all todos are done", () => {
    expect(
      calcWeeklyProgress([{ status: "DONE" }, { status: "DONE" }])
    ).toBe(100);
  });

  it("returns the rounded percentage for partial completion", () => {
    // 1/3 = 33.33... -> rounds to 33
    expect(
      calcWeeklyProgress([
        { status: "DONE" },
        { status: "TODO" },
        { status: "DOING" },
      ])
    ).toBe(33);
  });

  it("returns 0 when none are done", () => {
    expect(
      calcWeeklyProgress([{ status: "TODO" }, { status: "DOING" }])
    ).toBe(0);
  });
});

describe("calcYearlyProgress", () => {
  it("returns 0 when there are no linked weekly todos", () => {
    expect(calcYearlyProgress([])).toBe(0);
  });

  it("computes progress from linked weekly completion", () => {
    expect(
      calcYearlyProgress([{ status: "DONE" }, { status: "TODO" }])
    ).toBe(50);
  });
});
