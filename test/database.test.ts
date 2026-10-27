import { describe, expect, it } from "vitest";

import { assertSafeTestDatabase, toTestDatabaseUrl } from "./database";

const WORKING_URL = "postgresql://crm_user:s3cret@localhost:5432/crm";

describe("toTestDatabaseUrl", () => {
  it("adds _test to the database name and keeps everything else", () => {
    expect(toTestDatabaseUrl(WORKING_URL)).toBe(
      "postgresql://crm_user:s3cret@localhost:5432/crm_test",
    );
  });

  it("keeps connection parameters", () => {
    expect(toTestDatabaseUrl(`${WORKING_URL}?sslmode=disable`)).toBe(
      "postgresql://crm_user:s3cret@localhost:5432/crm_test?sslmode=disable",
    );
  });

  it("refuses an address without a database name", () => {
    expect(() =>
      toTestDatabaseUrl("postgresql://crm_user:s3cret@localhost:5432"),
    ).toThrow(/database name/i);
  });

  it("refuses something that is not an address", () => {
    expect(() => toTestDatabaseUrl("not a url")).toThrow();
  });
});

describe("assertSafeTestDatabase", () => {
  it("accepts a _test database next to the working one", () => {
    expect(() =>
      assertSafeTestDatabase(toTestDatabaseUrl(WORKING_URL), WORKING_URL),
    ).not.toThrow();
  });

  it("refuses the working database", () => {
    expect(() => assertSafeTestDatabase(WORKING_URL, WORKING_URL)).toThrow(
      /working database/i,
    );
  });

  it("refuses a database whose name does not end with _test", () => {
    expect(() =>
      assertSafeTestDatabase(
        "postgresql://crm_user:s3cret@localhost:5432/other",
        WORKING_URL,
      ),
    ).toThrow(/_test/);
  });

  it("refuses a _test name that only looks like one", () => {
    expect(() =>
      assertSafeTestDatabase(
        "postgresql://crm_user:s3cret@localhost:5432/crm_test_backup",
        WORKING_URL,
      ),
    ).toThrow(/_test/);
  });

  it("does not put the password into the error", () => {
    expect(() => assertSafeTestDatabase(WORKING_URL, WORKING_URL)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("s3cret"),
      }),
    );
  });
});
