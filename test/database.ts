// Which database the tests run against.
//
// Tests fill the database with their own data and empty its tables before
// every test, so they must never touch the working database. They use a
// database next to it, in the same PostgreSQL: the same address with `_test`
// added to the database name. Nothing has to be added to .env for that.

const TEST_SUFFIX = "_test";

export function databaseNameOf(address: string): string {
  return decodeURIComponent(new URL(address).pathname.replace(/^\//, ""));
}

// "…/crm" becomes "…/crm_test". User, password, host, port and connection
// parameters stay as they are.
export function toTestDatabaseUrl(workingUrl: string): string {
  const url = new URL(workingUrl);
  const name = databaseNameOf(workingUrl);

  if (!name) {
    throw new Error("DATABASE_URL has no database name.");
  }

  url.pathname = `/${encodeURIComponent(name + TEST_SUFFIX)}`;

  return url.toString();
}

// The last check before anything is created or emptied. The messages name the
// database only, never the address: it holds the password.
export function assertSafeTestDatabase(
  testUrl: string,
  workingUrl: string,
): void {
  const test = new URL(testUrl);
  const working = new URL(workingUrl);
  const testName = databaseNameOf(testUrl);

  if (test.host === working.host && testName === databaseNameOf(workingUrl)) {
    throw new Error(
      `Refusing to run tests: "${testName}" is the working database.`,
    );
  }

  if (!testName.endsWith(TEST_SUFFIX)) {
    throw new Error(
      `Refusing to run tests: the database name "${testName}" does not end with ${TEST_SUFFIX}.`,
    );
  }
}
