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
  parseTimestamp,
  type ContactField,
  type FieldErrors,
} from "@/lib/validation";

export type ActionResult<Field extends string, Data = undefined> =
  | { ok: true; data: Data }
  | { ok: false; errors: FieldErrors<Field>; message?: string };

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";

const CONTACT_CHANGED_ELSEWHERE =
  "Пока вы редактировали, этот контакт изменили в другой вкладке. Чтобы не затереть те изменения, ваши правки не сохранены. Скопируйте нужный текст, обновите страницу и внесите правки заново.";

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

// `updatedAt` is when the values shown in the edit form were last saved.
export async function updateContactAction(
  contactId: number,
  updatedAt: string,
  formData: FormData,
): Promise<ActionResult<ContactField>> {
  const id = parseContactId(contactId);
  const expectedUpdatedAt = parseTimestamp(updatedAt);

  if (id === null || expectedUpdatedAt === null) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  const parsed = parseContactForm(formData);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const result = await updateContact(id, parsed.data, expectedUpdatedAt);

  if (result === "not_found") {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  if (result === "changed_elsewhere") {
    return { ok: false, errors: {}, message: CONTACT_CHANGED_ELSEWHERE };
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
