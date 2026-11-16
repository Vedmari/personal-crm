// Runs in every `db` test file before the test file itself is loaded.

import postgres from "postgres";
import { afterAll, beforeEach, inject, vi } from "vitest";

import { databaseNameOf } from "./database";
// Not test/factories.ts: it imports src/db, which must not be loaded before
// DATABASE_URL points at the test database below.
import { signInAs, USER_A, USER_B } from "./signed-in";

const testUrl = inject("testDatabaseUrl");

// The app reads DATABASE_URL when src/db/index.ts is imported, which happens
// after this file, so the app talks to the test database.
process.env.DATABASE_URL = testUrl;

// refresh() redraws the page of a request. There is no request in a test.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

// There is no sign-in cookie in a test either: the server actions work for
// the user of signInAs (test/signed-in.ts). Without a user, requireUserId
// stops the action the way redirect("/login") does: with an error.
vi.mock("@/lib/current-user", async () => {
  const { signedInAs } = await import("./signed-in");

  return {
    getCurrentUser: async () => {
      const id = signedInAs();
      return id === null ? null : { id, email: `${id}@example.com` };
    },
    requireUserId: async () => {
      const id = signedInAs();

      if (id === null) {
        throw new Error("NEXT_REDIRECT: not signed in");
      }

      return id;
    },
  };
});

const sql = postgres(testUrl, { max: 1, onnotice: () => {} });

// Every test starts with empty tables and ids that count from 1 again.
beforeEach(async () => {
  const [{ name }] = await sql<
    { name: string }[]
  >`select current_database() as name`;

  if (!name.endsWith("_test") || name !== databaseNameOf(testUrl)) {
    throw new Error(
      `Refusing to empty "${name}": it is not the test database.`,
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

  // Users A and B; the test works as A until it signs in as somebody else.
  await sql`
    insert into "user" (id, name, email, email_verified) values
      (${USER_A}, '', 'a@example.com', true),
      (${USER_B}, '', 'b@example.com', true)
  `;
  signInAs(USER_A);
});

afterAll(async () => {
  await sql.end();
});
