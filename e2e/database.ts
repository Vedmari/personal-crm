// Which database the browser tests run against: `<working>_e2e_test`, next to
// the working one in the same PostgreSQL (see test/database.ts). The app under
// test is started with this address, so the working contacts are not touched.

import postgres, { type Sql } from "postgres";

import {
  assertSafeTestDatabase,
  databaseNameOf,
  toE2eDatabaseUrl,
} from "../test/database";

// The people who are already in the book when a test starts
// (resetDatabase puts them there).
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

// Every test starts from the same book: only SEEDED_CONTACTS, then whatever
// `fill` adds. The app under test reads the database on every request, so it
// sees the new rows at once.
export async function resetDatabase(
  fill?: (sql: Sql) => Promise<void>,
): Promise<void> {
  const url = e2eDatabaseUrl();
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [{ name }] = await sql<
      { name: string }[]
    >`select current_database() as name`;

    if (!name.endsWith("_e2e_test") || name !== databaseNameOf(url)) {
      throw new Error(
        `Refusing to empty "${name}": it is not the e2e database.`,
      );
    }

    const tables = await sql<{ name: string }[]>`
      select quote_ident(tablename) as name from pg_tables where schemaname = 'public'
    `;

    if (tables.length > 0) {
      await sql.unsafe(
        `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
      );
    }

    await sql`insert into contacts ${sql(SEEDED_CONTACTS, "name", "about")}`;
    await fill?.(sql);
  } finally {
    await sql.end();
  }
}
