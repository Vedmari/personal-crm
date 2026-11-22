// openspec/specs/data-ownership: the contacts, notes and groups
// that are already in the database go to the owner from OWNER_EMAIL.
//
// The test has a database of its own, `<working>_migration_test`: it is
// dropped and made again before every test, gets the migrations up to 0004
// and the rows of an old database, and then the deploy's scripts/migrate.mts
// runs on it, as on the server. The test drops the database at the end.

import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, inject, it } from "vitest";

import { databaseNameOf } from "../test/database";

const testUrl = inject("testDatabaseUrl");

// "…/crm_test" -> "…/crm_migration_test": next to the test database.
function migrationDatabaseUrl(): { url: string; name: string } {
  const url = new URL(testUrl);
  const name = databaseNameOf(testUrl).replace(/_test$/, "_migration_test");

  // The name goes into "create database" and "drop database", which take no
  // parameters, so it may hold only letters, digits and underscores.
  if (!/^[A-Za-z0-9_]+_migration_test$/.test(name)) {
    throw new Error(`Refusing to use "${name}" as the migration database.`);
  }

  url.pathname = `/${name}`;

  return { url: url.toString(), name };
}

const migration = migrationDatabaseUrl();

const maintenanceUrl = (() => {
  const url = new URL(testUrl);
  url.pathname = "/postgres";
  return url.toString();
})();

// The migrations of the database before sign-in: 0000-0004.
let oldMigrationsFolder: string;

async function copyOldMigrations(): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), "crm-migrations-"));

  await cp("drizzle", folder, { recursive: true });

  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: { idx: number }[];
  };

  journal.entries = journal.entries.filter((entry) => entry.idx <= 4);
  await writeFile(journalPath, JSON.stringify(journal));

  return folder;
}

async function withAdmin(work: (admin: postgres.Sql) => Promise<void>) {
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });

  try {
    await work(admin);
  } finally {
    await admin.end();
  }
}

async function dropMigrationDatabase(): Promise<void> {
  await withAdmin(async (admin) => {
    await admin.unsafe(
      `drop database if exists "${migration.name}" with (force)`,
    );
  });
}

async function withDatabase<Result>(
  work: (sql: postgres.Sql) => Promise<Result>,
): Promise<Result> {
  const sql = postgres(migration.url, { max: 1, onnotice: () => {} });

  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// An old database: the schema of 0004, without users.
async function makeOldDatabase(): Promise<void> {
  await dropMigrationDatabase();
  await withAdmin(async (admin) => {
    await admin.unsafe(`create database "${migration.name}"`);
  });
  await withDatabase(async (sql) => {
    await migrate(drizzle(sql), { migrationsFolder: oldMigrationsFolder });
  });
}

const OLD_CONTACTS = ["Анна Смирнова", "Борис Петров", "Вера Соколова"];

// Three contacts (one of them deleted and waiting for "Вернуть"), four notes,
// two groups and three memberships.
async function fillOldDatabase(): Promise<void> {
  await withDatabase(async (sql) => {
    const ids: number[] = [];

    for (const name of OLD_CONTACTS) {
      const [row] = await sql<{ id: number }[]>`
        insert into contacts (name) values (${name}) returning id
      `;
      ids.push(row.id);
    }

    const [anna, boris, vera] = ids;

    await sql`update contacts set deleted_at = now() where id = ${vera}`;
    await sql`
      insert into notes (contact_id, body) values
        (${anna}, 'Созвонились'), (${anna}, 'Встретились'),
        (${boris}, 'Обсудили рассаду'), (${vera}, 'Поздравила')
    `;

    const groups = await sql<{ id: number }[]>`
      insert into groups (name) values ('Семья'), ('Теннис') returning id
    `;
    const [family, tennis] = groups.map((row) => row.id);

    await sql`
      insert into contact_groups (contact_id, group_id) values
        (${anna}, ${family}), (${anna}, ${tennis}), (${boris}, ${family})
    `;
  });
}

type Counts = {
  contacts: number;
  notes: number;
  groups: number;
  memberships: number;
};

async function countRows(): Promise<Counts> {
  return withDatabase(async (sql) => {
    const [row] = await sql<Counts[]>`
      select
        (select count(*)::int from contacts) as contacts,
        (select count(*)::int from notes) as notes,
        (select count(*)::int from groups) as groups,
        (select count(*)::int from contact_groups) as memberships
    `;

    return row;
  });
}

type RunResult = { exitCode: number; stdout: string; stderr: string };

// The deploy's migration step, with OWNER_EMAIL as given (undefined: not set).
function runMigrate(ownerEmail: string | undefined): Promise<RunResult> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: migration.url,
  };

  delete env.OWNER_EMAIL;

  if (ownerEmail !== undefined) {
    env.OWNER_EMAIL = ownerEmail;
  }

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["scripts/migrate.mts"],
      { env, encoding: "utf8" },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? Number(error.code ?? 1) : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

beforeAll(async () => {
  oldMigrationsFolder = await copyOldMigrations();
});

beforeEach(async () => {
  await makeOldDatabase();
});

afterAll(async () => {
  await dropMigrationDatabase();
  await rm(oldMigrationsFolder, { recursive: true, force: true });
});

it("gives every old row to the owner and keeps them all [Первый вход владельца после обновления]", async () => {
  await fillOldDatabase();
  const before = await countRows();

  const run = await runMigrate("owner@example.com");

  expect(run.exitCode).toBe(0);
  expect(await countRows()).toEqual(before);

  await withDatabase(async (sql) => {
    const users = await sql<{ id: string; email: string; verified: boolean }[]>`
      select id, email, email_verified as verified from "user"
    `;

    expect(users).toEqual([
      { id: expect.any(String), email: "owner@example.com", verified: true },
    ]);

    const owners = await sql<{ owner: string | null }[]>`
      select owner_id as owner from contacts
      union all
      select owner_id as owner from groups
    `;

    expect(owners).toHaveLength(before.contacts + before.groups);
    expect(owners.every((row) => row.owner === users[0].id)).toBe(true);
  });

  // The deploy log shows that nothing is lost, without names or emails.
  expect(run.stdout).toContain("Contacts: 3 before, 3 after");
  expect(run.stdout).toContain("Notes: 4 before, 4 after");
  expect(run.stdout).toContain("Groups: 2 before, 2 after");

  for (const secret of ["owner@example.com", ...OLD_CONTACTS]) {
    expect(run.stdout + run.stderr).not.toContain(secret);
  }
}, 60_000);

it("finds the owner under any spelling of the email [Почта владельца в другом написании]", async () => {
  await fillOldDatabase();

  const run = await runMigrate(" Owner@Example.com");

  expect(run.exitCode).toBe(0);

  await withDatabase(async (sql) => {
    const users = await sql<{ email: string }[]>`select email from "user"`;

    expect(users).toEqual([{ email: "owner@example.com" }]);
  });
}, 60_000);

it("stops and changes nothing without the owner's email [Почта владельца не задана]", async () => {
  await fillOldDatabase();
  const before = await countRows();

  for (const ownerEmail of [undefined, "", "   "]) {
    const run = await runMigrate(ownerEmail);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain("OWNER_EMAIL is not set");
  }

  expect(await countRows()).toEqual(before);

  await withDatabase(async (sql) => {
    const [state] = await sql<
      { users: string | null; ownerColumns: number; migrations: number }[]
    >`
      select
        to_regclass('public.user')::text as users,
        (select count(*)::int from information_schema.columns
          where table_schema = 'public' and column_name = 'owner_id') as "ownerColumns",
        (select count(*)::int from drizzle.__drizzle_migrations) as migrations
    `;

    expect(state).toEqual({ users: null, ownerColumns: 0, migrations: 5 });
  });
}, 60_000);

it("updates an empty database without the owner's email [Пустая база без почты владельца]", async () => {
  const run = await runMigrate(undefined);

  expect(run.exitCode).toBe(0);

  await withDatabase(async (sql) => {
    const columns = await sql<{ table: string; nullable: string }[]>`
      select table_name as table, is_nullable as nullable
      from information_schema.columns
      where table_schema = 'public' and column_name = 'owner_id'
      order by table_name
    `;

    expect(columns).toEqual([
      { table: "contacts", nullable: "NO" },
      { table: "groups", nullable: "NO" },
    ]);
  });
}, 60_000);

it("keeps old contacts with an unknown birthday", async () => {
  await fillOldDatabase();
  expect((await runMigrate("owner@example.com")).exitCode).toBe(0);
  await withDatabase(async (sql) => {
    const rows =
      await sql`select name, birth_day, birth_month, birth_year from contacts order by id`;
    expect(rows).toEqual(
      OLD_CONTACTS.map((name) => ({
        name,
        birth_day: null,
        birth_month: null,
        birth_year: null,
      })),
    );
  });
}, 60_000);
