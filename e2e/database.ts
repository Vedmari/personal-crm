// Which database the browser tests run against: `<working>_e2e_test`, next to
// the working one in the same PostgreSQL (see test/database.ts). The app under
// test is started with this address, so the working contacts are not touched.

import postgres, { type Sql } from "postgres";

import { E2E_USER_EMAIL } from "./auth";
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

// The tables of the data. Users and their sign-ins stay: the e2e user keeps
// the sign-in of the "setup" project for the whole run.
const DATA_TABLES = [
  "contact_groups",
  "notes",
  "contacts",
  "groups",
  "login_link_sends",
];

// The e2e user, made here if nobody has signed in with the email yet: the
// first sign-in by link then finds this user by the email.
async function e2eUserId(sql: Sql): Promise<string> {
  await sql`
    insert into "user" (id, name, email, email_verified)
    values (gen_random_uuid()::text, '', ${E2E_USER_EMAIL}, true)
    on conflict (email) do nothing
  `;

  const [row] = await sql<
    { id: string }[]
  >`select id from "user" where email = ${E2E_USER_EMAIL}`;

  return row.id;
}

// Every test starts from the same book of the e2e user: only SEEDED_CONTACTS,
// then whatever `fill` adds. `fill` gets the e2e user's id for the owner_id of
// its rows. The app under test reads the database on every request, so it
// sees the new rows at once.
export async function resetDatabase(
  fill?: (sql: Sql, ownerId: string) => Promise<void>,
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

    await sql.unsafe(
      `truncate table ${DATA_TABLES.join(", ")} restart identity cascade`,
    );

    const ownerId = await e2eUserId(sql);

    await sql`
      insert into contacts ${sql(
        SEEDED_CONTACTS.map((contact) => ({ ...contact, owner_id: ownerId })),
        "name",
        "about",
        "owner_id",
      )}
    `;
    await fill?.(sql, ownerId);
  } finally {
    await sql.end();
  }
}

// Straight access to the e2e database, for what a test cannot wait for:
// a link that is 16 minutes old, a sign-in of 31 days ago.
export async function withDatabase<Result>(
  work: (sql: Sql) => Promise<Result>,
): Promise<Result> {
  const sql = postgres(e2eDatabaseUrl(), { max: 1, onnotice: () => {} });

  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}
