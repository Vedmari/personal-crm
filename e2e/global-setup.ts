// Runs once before the browser tests: makes sure the e2e database exists, has
// the current schema and holds only the contacts the tests expect.

import { execFileSync } from "node:child_process";

import postgres from "postgres";

import { databaseNameOf } from "../test/database";
import { e2eDatabaseUrl, SEEDED_CONTACTS } from "./database";

// The address goes in the environment, not in the arguments: it holds the
// password.
function runScript(script: string, url: string): void {
  try {
    execFileSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    const reason = stderr.trim().split("\n").slice(0, 3).join("\n");

    throw new Error(`Preparing the e2e database failed (${script}):\n${reason}`);
  }
}

export default async function globalSetup(): Promise<void> {
  const url = e2eDatabaseUrl();

  runScript("test/create-database.mts", url);
  // The same script the deploy uses, pointed at the e2e database.
  runScript("scripts/migrate.mts", url);

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [{ name }] = await sql<{ name: string }[]>`select current_database() as name`;

    if (!name.endsWith("_e2e_test") || name !== databaseNameOf(url)) {
      throw new Error(`Refusing to empty "${name}": it is not the e2e database.`);
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
  } finally {
    await sql.end();
  }
}
