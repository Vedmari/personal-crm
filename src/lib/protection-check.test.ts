// Deliberately failing test: checks that a red CI keeps a PR out of main.
// This PR is closed without merging.

import { describe, expect, it } from "vitest";

describe("branch protection", () => {
  it("fails on purpose", () => {
    expect(1 + 1).toBe(3);
  });
});
