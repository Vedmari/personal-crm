import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { ContactInput } from "@/lib/validation";

import { db } from "./index";
import { contacts, notes } from "./schema";

export type ContactListItem = {
  id: number;
  name: string;
  about: string;
  phone: string;
  email: string;
};

// "ё" and "е" are interchangeable in everyday Russian spelling,
// so search treats them as the same letter.
function normalizeForSearch(value: string): string {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Search looks at the name and at "who this is" (`about`). Every word of the
// query must appear in one of them, so "петров иван" finds "Иван Петров" and
// "анна ветеринар" finds an Anna described as a vet.
function contactMatches(search: string): SQL | undefined {
  const words = normalizeForSearch(search).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return undefined;
  }

  return and(
    ...words.map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(
        sql`replace(lower(${contacts.name}), 'ё', 'е') like ${pattern}`,
        sql`replace(lower(${contacts.about}), 'ё', 'е') like ${pattern}`,
      );
    }),
  );
}

// The database default order ignores spaces, which puts "Александр Яковлев"
// after "Александра Белова". The Russian ICU collation sorts word by word,
// the way a phone book does, and treats "ё" as "е".
const nameInAlphabeticalOrder = sql`${contacts.name} collate "ru-x-icu"`;

export async function listContacts(search: string): Promise<{
  items: ContactListItem[];
  total: number;
}> {
  const [items, totals] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        about: contacts.about,
        phone: contacts.phone,
        email: contacts.email,
      })
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), contactMatches(search)))
      .orderBy(nameInAlphabeticalOrder, asc(contacts.id)),
    db
      .select({ value: count() })
      .from(contacts)
      .where(isNull(contacts.deletedAt)),
  ]);

  return { items, total: totals[0]?.value ?? 0 };
}

export async function getContact(id: number) {
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1);

  return rows[0];
}

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.contactId, contactId), isNull(notes.deletedAt)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

export async function createContact(input: ContactInput) {
  const rows = await db
    .insert(contacts)
    .values(input)
    .returning({ id: contacts.id, name: contacts.name });

  return rows[0];
}

export type UpdateContactResult = "updated" | "changed_elsewhere" | "not_found";

// Saves only if the contact has not been saved since the edit form got its
// data. Without this check a tab that was opened earlier would silently
// overwrite newer changes with the old values it still shows.
export async function updateContact(
  id: number,
  input: ContactInput,
  expectedUpdatedAt: Date,
): Promise<UpdateContactResult> {
  const rows = await db
    .update(contacts)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(contacts.id, id),
        isNull(contacts.deletedAt),
        // The browser keeps time to the millisecond, the database to the
        // microsecond, so the stored value is cut down before comparing.
        sql`date_trunc('milliseconds', ${contacts.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: contacts.id });

  if (rows[0]) {
    return "updated";
  }

  return (await getContact(id)) ? "changed_elsewhere" : "not_found";
}

export async function addNote(contactId: number, body: string) {
  const rows = await db
    .insert(notes)
    .values({ contactId, body })
    .returning({ id: notes.id });

  return rows[0];
}

// Deleting only marks a row (`deletedAt`). The row is erased when the
// "Вернуть" toast closes. If the tab was closed before that, the row is
// erased by a later deletion: the toast timer pauses while the tab is hidden,
// so an hour leaves plenty of room for a toast that is still open.
const ERASE_DELETED_AFTER = sql`interval '1 hour'`;

async function eraseExpiredDeletions() {
  const expired = sql`now() - ${ERASE_DELETED_AFTER}`;

  await db.delete(notes).where(lt(notes.deletedAt, expired));
  // Notes of an erased contact go with it (on delete cascade).
  await db.delete(contacts).where(lt(contacts.deletedAt, expired));
}

export async function deleteContact(id: number) {
  await eraseExpiredDeletions();

  const rows = await db
    .update(contacts)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .returning({ id: contacts.id, name: contacts.name });

  return rows[0];
}

export async function restoreContact(id: number) {
  const rows = await db
    .update(contacts)
    .set({ deletedAt: null })
    .where(and(eq(contacts.id, id), isNotNull(contacts.deletedAt)))
    .returning({ id: contacts.id, name: contacts.name });

  return rows[0];
}

// Only a contact marked as deleted can be erased, so a stray call
// cannot wipe out a contact that is in use.
export async function eraseDeletedContact(id: number) {
  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), isNotNull(contacts.deletedAt)));
}

export async function deleteNote(id: number) {
  await eraseExpiredDeletions();

  const rows = await db
    .update(notes)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
    .returning({ id: notes.id });

  return rows[0];
}

export async function restoreNote(id: number) {
  const rows = await db
    .update(notes)
    .set({ deletedAt: null })
    .where(and(eq(notes.id, id), isNotNull(notes.deletedAt)))
    .returning({ id: notes.id });

  return rows[0];
}

export async function eraseDeletedNote(id: number) {
  await db
    .delete(notes)
    .where(and(eq(notes.id, id), isNotNull(notes.deletedAt)));
}
