import { describe, expect, it } from "vitest";
import {
  normalizeDailyDate,
  normalizeWeekStart,
  normalizeYearStart,
} from "./period";

describe("normalizeDailyDate", () => {
  it("truncates to UTC midnight", () => {
    const d = normalizeDailyDate(new Date("2026-09-14T15:32:00Z"));
    expect(d.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });
});

describe("normalizeWeekStart", () => {
  it("normalizes a mid-week date to that week's Monday", () => {
    // 2026-09-14 is a Monday; 2026-09-17 is a Thursday in the same week
    const d = normalizeWeekStart(new Date("2026-09-17T10:00:00Z"));
    expect(d.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("a Monday normalizes to itself", () => {
    const d = normalizeWeekStart(new Date("2026-09-14T00:00:00Z"));
    expect(d.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("a Sunday normalizes to the preceding Monday", () => {
    const d = normalizeWeekStart(new Date("2026-09-20T23:00:00Z"));
    expect(d.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("handles a week that spans into January correctly (ISO week)", () => {
    // 2025-12-31 is a Wednesday; that ISO week starts Monday 2025-12-29
    const d = normalizeWeekStart(new Date("2025-12-31T00:00:00Z"));
    expect(d.toISOString()).toBe("2025-12-29T00:00:00.000Z");
  });

  it("handles a January date whose week starts in December", () => {
    // 2026-01-01 is a Thursday; that ISO week starts Monday 2025-12-29
    const d = normalizeWeekStart(new Date("2026-01-01T00:00:00Z"));
    expect(d.toISOString()).toBe("2025-12-29T00:00:00.000Z");
  });
});

describe("normalizeYearStart", () => {
  it("normalizes any date in a year to Jan 1 of that year", () => {
    const d = normalizeYearStart(new Date("2026-09-14T15:32:00Z"));
    expect(d.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("normalizes Dec 31 to Jan 1 of the same year (not the next)", () => {
    const d = normalizeYearStart(new Date("2026-12-31T23:59:59Z"));
    expect(d.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
