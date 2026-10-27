// Runs in every `db` test file before the test file itself is loaded.

import postgres from "postgres";
import { afterAll, beforeEach, inject, vi } from "vitest";

import { databaseNameOf } from "./database";

const testUrl = inject("testDatabaseUrl");

// The app reads DATABASE_URL when src/db/index.ts is imported, which happens
// after this file, so the app talks to the test database.
process.env.DATABASE_URL = testUrl;

// refresh() redraws the page of a request. There is no request in a test.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const sql = postgres(testUrl, { max: 1, onnotice: () => {} });

// Every test starts with empty tables and ids that count from 1 again.
beforeEach(async () => {
  const [{ name }] = await sql<{ name: string }[]>`select current_database() as name`;

  if (!name.endsWith("_test") || name !== databaseNameOf(testUrl)) {
    throw new Error(`Refusing to empty "${name}": it is not the test database.`);
  }

  const tables = await sql<{ name: string }[]>`
    select quote_ident(tablename) as name from pg_tables where schemaname = 'public'
  `;

  if (tables.length > 0) {
    await sql.unsafe(
      `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
    );
  }
});

afterAll(async () => {
  await sql.end();
});
