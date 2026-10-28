// Which database the browser tests run against: `<working>_e2e_test`, next to
// the working one in the same PostgreSQL (see test/database.ts). The app under
// test is started with this address, so the working contacts are not touched.

import { assertSafeTestDatabase, toE2eDatabaseUrl } from "../test/database";

// The people who are already in the book when the tests start
// (e2e/global-setup.ts puts them there).
export const SEEDED_CONTACTS = [
  { name: "Борис Петров", about: "Сосед по даче" },
  { name: "Вера Соколова", about: "Коллега по работе" },
];

function loadEnvFile(): void {
  try {
    // Does not override variables that are already set (CI sets them itself).
    process.loadEnvFile(".env");
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  }
}

export function e2eDatabaseUrl(): string {
  loadEnvFile();

  const workingUrl = process.env.DATABASE_URL;

  if (!workingUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the values.",
    );
  }

  const e2eUrl = toE2eDatabaseUrl(workingUrl);

  assertSafeTestDatabase(e2eUrl, workingUrl);

  return e2eUrl;
}
