// openspec/changes/login/specs/data-ownership: the test data of `pnpm db:seed`
// belongs to the owner from OWNER_EMAIL. The script runs as a separate
// process against the test database, the way `pnpm db:seed` runs it.

import { execFile } from "node:child_process";

import { eq, sql } from "drizzle-orm";
import { expect, inject, it } from "vitest";

import { db } from "@/db";
import { listContacts, listGroups, listOverdueContacts } from "@/db/queries";
import { user } from "@/db/schema";

import { USER_B } from "../test/factories";

const testUrl = inject("testDatabaseUrl");

type RunResult = { exitCode: number; stdout: string; stderr: string };

function runSeed(ownerEmail: string | undefined): Promise<RunResult> {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testUrl };

  delete env.OWNER_EMAIL;

  if (ownerEmail !== undefined) {
    env.OWNER_EMAIL = ownerEmail;
  }

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["scripts/seed.mts"],
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

async function createUser(id: string, email: string): Promise<void> {
  await db.insert(user).values({ id, name: "", email, emailVerified: true });
}

type Counts = { contacts: number; notes: number; groups: number };

// How many contacts, notes and groups belong to the user.
async function countOwned(ownerId: string): Promise<Counts> {
  const [row] = await db.execute<Counts>(sql`
    select
      (select count(*)::int from contacts c where c.owner_id = ${ownerId}) as contacts,
      (select count(*)::int from notes n join contacts c on c.id = n.contact_id
        where c.owner_id = ${ownerId}) as notes,
      (select count(*)::int from groups g where g.owner_id = ${ownerId}) as groups
  `);

  return { ...row };
}

async function countAll(): Promise<Counts> {
  const [row] = await db.execute<Counts>(sql`
    select
      (select count(*)::int from contacts) as contacts,
      (select count(*)::int from notes) as notes,
      (select count(*)::int from groups) as groups
  `);

  return { ...row };
}

it("makes the test data for the owner [Наполнить пустую базу]", async () => {
  const run = await runSeed(" Owner@Example.com");

  expect(run.exitCode).toBe(0);

  const owners = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, "owner@example.com"));

  expect(owners).toHaveLength(1);

  const owned = await countOwned(owners[0].id);

  expect(owned.contacts).toBe(1000);
  expect(owned.notes).toBeGreaterThan(0);
  expect(owned.groups).toBeGreaterThan(0);
  expect(owned).toEqual(await countAll());
}, 60_000);

it("leaves the test data out of other users' books [Другой пользователь демо-данных не видит]", async () => {
  const run = await runSeed("owner@example.com");

  expect(run.exitCode).toBe(0);
  expect(await countOwned(USER_B)).toEqual({
    contacts: 0,
    notes: 0,
    groups: 0,
  });

  // What B sees: an empty list, no groups, nobody to contact.
  expect(await listContacts(USER_B, "")).toEqual({
    items: [],
    matched: 0,
    total: 0,
  });
  expect(await listGroups(USER_B)).toEqual([]);
  expect(await listOverdueContacts(USER_B)).toEqual([]);
}, 60_000);

it("uses the owner who has signed in already", async () => {
  await createUser("owner-id", "owner@example.com");

  const run = await runSeed("owner@example.com");

  expect(run.exitCode).toBe(0);
  expect(
    await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "owner@example.com")),
  ).toEqual([{ id: "owner-id" }]);
  expect((await countOwned("owner-id")).contacts).toBe(1000);
}, 60_000);

it("stops without the owner's email and inserts nothing", async () => {
  const usersBefore = await db.select().from(user);

  for (const ownerEmail of [undefined, "", "  "]) {
    const run = await runSeed(ownerEmail);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain("OWNER_EMAIL is not set");
  }

  expect(await countAll()).toEqual({ contacts: 0, notes: 0, groups: 0 });
  expect(await db.select().from(user)).toEqual(usersBefore);
}, 60_000);
