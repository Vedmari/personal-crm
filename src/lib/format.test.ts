import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDay } from "./format";

describe("formatDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00+03:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves out the year of the current year [Срок ещё не прошёл]", () => {
    expect(formatDay("2026-11-24")).toBe("24 ноября");
  });

  it("leaves out the year of a past day of the current year [Срок прошёл]", () => {
    expect(formatDay("2026-10-12")).toBe("12 октября");
  });

  it("adds the year of another year [Срок в прошлом году]", () => {
    expect(formatDay("2025-12-01")).toBe("1 декабря 2025");
  });

  it("takes the year in Moscow time on New Year's night", () => {
    // Still 2025 in UTC, already 2026 in Moscow.
    vi.setSystemTime(new Date("2025-12-31T22:30:00Z"));

    expect(formatDay("2026-01-05")).toBe("5 января");
  });
});
