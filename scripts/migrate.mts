// Applies pending database migrations from ./drizzle and exits.
//
// On the server the deploy runs it as a one-off container from the new image,
// before the app starts (deploy/deploy.sh). A non-zero exit stops the deploy,
// so the app keeps running on the previous image.
// Locally `pnpm db:migrate` runs this same script with .env loaded.
//
// OWNER_EMAIL is the email of the owner of the data that is already in the
// database: migration 0005 gives the old contacts and groups to that user
// (creating the user if needed). The email is put, in one spelling, into the
// setting crm.owner_email of this script's only connection, which the
// migrations read. On an empty database it is not needed.
//
// The log tells how many contacts, notes and groups there were before and
// after, so it shows that nothing was lost. Never names or emails.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { normalizeEmail } from "../src/lib/validation.ts";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const ownerEmail = normalizeEmail(process.env.OWNER_EMAIL ?? "");

// One connection: the setting below lives in it, and the migrations run in it.
const client = postgres(url, { max: 1, onnotice: () => {} });

async function tableExists(name: string): Promise<boolean> {
  const [table] = await client`select to_regclass(${name}) as name`;
  return table.name !== null;
}

async function countAppliedMigrations(): Promise<number> {
  if (!(await tableExists("drizzle.__drizzle_migrations"))) {
    return 0;
  }

  const [row] =
    await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
  return row.count;
}

const COUNTED_TABLES = [
  ["Contacts", "contacts"],
  ["Notes", "notes"],
  ["Groups", "groups"],
] as const;

// A new database has no tables yet: then there are 0 rows.
async function countRows(): Promise<number[]> {
  const counts: number[] = [];

  for (const [, table] of COUNTED_TABLES) {
    if (await tableExists(`public.${table}`)) {
      const [row] =
        await client`select count(*)::int as count from ${client(table)}`;
      counts.push(row.count);
    } else {
      counts.push(0);
    }
  }

  return counts;
}

// The message of the database, without the statement or its values: a failed
// migration names its reason ("OWNER_EMAIL is not set: …") there.
function describeFailure(error: unknown): string {
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;

  if (cause instanceof postgres.PostgresError) {
    return `${cause.code} ${cause.message}`;
  }

  return cause instanceof Error ? cause.message : String(cause);
}

try {
  await client`select set_config('crm.owner_email', ${ownerEmail}, false)`;

  const migrationsBefore = await countAppliedMigrations();
  const rowsBefore = await countRows();

  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

  const migrationsAfter = await countAppliedMigrations();
  const rowsAfter = await countRows();

  console.log(
    `Migrations: ${migrationsAfter - migrationsBefore} applied now, ${migrationsAfter} applied in total.`,
  );

  COUNTED_TABLES.forEach(([label], index) => {
    console.log(
      `${label}: ${rowsBefore[index]} before, ${rowsAfter[index]} after.`,
    );
  });
} catch (error) {
  console.error(
    `Migrations failed, nothing was changed: ${describeFailure(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
