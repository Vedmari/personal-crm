// Small helpers for `db` tests: rows made straight in the test database.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts } from "@/db/schema";

export async function createTestContact(name: string): Promise<number> {
  const [row] = await db
    .insert(contacts)
    .values({ name })
    .returning({ id: contacts.id });

  return row.id;
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
