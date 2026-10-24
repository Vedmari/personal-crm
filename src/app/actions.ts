"use server";

import { refresh } from "next/cache";

import {
  addNote,
  createContact,
  deleteContact,
  deleteNote,
  eraseDeletedContact,
  eraseDeletedNote,
  getContact,
  restoreContact,
  restoreNote,
  updateContact,
} from "@/db/queries";
import {
  parseContactForm,
  parseId,
  parseNoteForm,
  parseTimestamp,
  type ContactField,
  type FieldErrors,
} from "@/lib/validation";

export type ActionResult<Field extends string, Data = undefined> =
  | { ok: true; data: Data }
  | { ok: false; errors: FieldErrors<Field>; message?: string };

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";

const NOTE_NOT_FOUND = "Заметка не найдена. Обновите страницу.";

const RESTORE_TOO_LATE = "Не получилось вернуть: запись уже удалена насовсем.";

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
  const id = parseId(contactId);
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
  const id = parseId(contactId);

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

// Deleting marks the contact; it is erased when the "Вернуть" toast closes.
export async function deleteContactAction(
  contactId: number,
): Promise<ActionResult<never, { id: number; name: string }>> {
  const id = parseId(contactId);
  const contact = id === null ? undefined : await deleteContact(id);

  if (!contact) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  // No refresh() here: it would redraw the card as "not found" before the
  // browser leaves it for the list.
  return { ok: true, data: contact };
}

export async function restoreContactAction(
  contactId: number,
): Promise<ActionResult<never, { id: number; name: string }>> {
  const id = parseId(contactId);
  const contact = id === null ? undefined : await restoreContact(id);

  if (!contact) {
    return { ok: false, errors: {}, message: RESTORE_TOO_LATE };
  }

  refresh();

  return { ok: true, data: contact };
}

export async function eraseDeletedContactAction(
  contactId: number,
): Promise<void> {
  const id = parseId(contactId);

  if (id !== null) {
    await eraseDeletedContact(id);
  }
}

export async function deleteNoteAction(
  noteId: number,
): Promise<ActionResult<never>> {
  const id = parseId(noteId);

  if (id === null || !(await deleteNote(id))) {
    return { ok: false, errors: {}, message: NOTE_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: undefined };
}

export async function restoreNoteAction(
  noteId: number,
): Promise<ActionResult<never>> {
  const id = parseId(noteId);

  if (id === null || !(await restoreNote(id))) {
    return { ok: false, errors: {}, message: RESTORE_TOO_LATE };
  }

  refresh();

  return { ok: true, data: undefined };
}

export async function eraseDeletedNoteAction(noteId: number): Promise<void> {
  const id = parseId(noteId);

  if (id !== null) {
    await eraseDeletedNote(id);
  }
}
