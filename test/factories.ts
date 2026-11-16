// Small helpers for `db` tests: rows made straight in the test database.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, groups, notes, type KeepInTouchInterval } from "@/db/schema";

import { USER_A } from "./signed-in";

// Users A and B are made before every test (test/setup-db.ts), and the test
// is signed in as A. Rows belong to A unless a test says otherwise.
export { signInAs, USER_A, USER_B } from "./signed-in";

export async function createTestContact(
  name: string,
  ownerId: string = USER_A,
): Promise<number> {
  const [row] = await db
    .insert(contacts)
    .values({ name, ownerId })
    .returning({ id: contacts.id });

  return row.id;
}

// Many contacts in one insert. Returns their ids in the order of `people`.
export async function createTestContacts(
  people: { name: string; about?: string }[],
  ownerId: string = USER_A,
): Promise<number[]> {
  const rows = await db
    .insert(contacts)
    .values(people.map((person) => ({ ...person, ownerId })))
    .returning({ id: contacts.id });

  return rows.map((row) => row.id);
}

export async function createTestGroup(
  name: string,
  ownerId: string = USER_A,
): Promise<number> {
  const [row] = await db
    .insert(groups)
    .values({ name, ownerId })
    .returning({ id: groups.id });

  return row.id;
}

// A note written at a given moment, e.g. "2026-09-10T12:00:00+03:00".
export async function addTestNote(
  contactId: number,
  createdAt: Date,
  body = "Созвонились",
): Promise<number> {
  const [row] = await db
    .insert(notes)
    .values({ contactId, body, createdAt })
    .returning({ id: notes.id });

  return row.id;
}

// An interval chosen at a given moment, which the card cannot do: it always
// chooses now.
export async function setTestKeepInTouch(
  contactId: number,
  every: KeepInTouchInterval,
  since: Date,
): Promise<void> {
  await db
    .update(contacts)
    .set({ keepInTouchEvery: every, keepInTouchSince: since })
    .where(eq(contacts.id, contactId));
}

// The same moment of the day, `days` days ago. Moscow has no daylight saving
// time, so it is exactly `days` Moscow calendar days before today.
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// What the "Удалить" button does while "Вернуть" is still possible.
export async function markContactDeleted(id: number): Promise<void> {
  await db
    .update(contacts)
    .set({ deletedAt: new Date() })
    .where(eq(contacts.id, id));
}

export function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return form;
}
