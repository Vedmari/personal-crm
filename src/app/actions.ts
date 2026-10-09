"use server";

import { refresh } from "next/cache";

import {
  addNote,
  createContact,
  getContact,
  updateContact,
} from "@/db/queries";
import {
  parseContactForm,
  parseContactId,
  parseNoteForm,
  type ContactField,
  type FieldErrors,
} from "@/lib/validation";

export type ActionResult<Field extends string, Data = undefined> =
  | { ok: true; data: Data }
  | { ok: false; errors: FieldErrors<Field>; message?: string };

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";

export async function createContactAction(
  formData: FormData,
): Promise<ActionResult<ContactField, { id: number; name: string }>> {
  const parsed = parseContactForm(formData);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const contact = await createContact(parsed.data);

  refresh();

  return { ok: true, data: contact };
}

export async function updateContactAction(
  contactId: number,
  formData: FormData,
): Promise<ActionResult<ContactField>> {
  const id = parseContactId(contactId);

  if (id === null) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  const parsed = parseContactForm(formData);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const updated = await updateContact(id, parsed.data);

  if (!updated) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: undefined };
}

export async function addNoteAction(
  contactId: number,
  formData: FormData,
): Promise<ActionResult<"body">> {
  const id = parseContactId(contactId);

  if (id === null || !(await getContact(id))) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  const parsed = parseNoteForm(formData);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  await addNote(id, parsed.data);

  refresh();

  return { ok: true, data: undefined };
}
