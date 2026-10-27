"use server";

import { refresh } from "next/cache";

import {
  addContactedNote,
  addNote,
  createContact,
  createGroup,
  deleteContact,
  deleteGroup,
  deleteNote,
  eraseContactedNote,
  eraseDeletedContact,
  eraseDeletedNote,
  getContact,
  restoreContact,
  renameGroup,
  restoreNote,
  setContactGroup,
  setKeepInTouch,
  updateContact,
} from "@/db/queries";
import {
  parseContactForm,
  parseId,
  parseGroupName,
  parseKeepInTouch,
  parseNoteForm,
  parseTimestamp,
  type ContactField,
  type FieldErrors,
} from "@/lib/validation";

export type ActionResult<Field extends string, Data = undefined> =
  | { ok: true; data: Data }
  | { ok: false; errors: FieldErrors<Field>; message?: string };

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";

const GROUP_NOT_FOUND = "Группа не найдена. Обновите страницу.";

const NOTE_NOT_FOUND = "Заметка не найдена. Обновите страницу.";

const RESTORE_TOO_LATE = "Не получилось вернуть: запись уже удалена насовсем.";

const UNDO_CONTACTED_TOO_LATE =
  "Не получилось отменить: этой заметки «Связались» уже нет.";

const KEEP_IN_TOUCH_INVALID =
  "Не получилось сохранить частоту. Обновите страницу и выберите ещё раз.";

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

// The interval is saved as soon as it is chosen in the card. `every` is
// null for "Не задано".
export async function setKeepInTouchAction(
  contactId: number,
  every: string | null,
): Promise<ActionResult<never>> {
  const id = parseId(contactId);
  const interval = parseKeepInTouch(every);

  if (id === null || interval === undefined) {
    return { ok: false, errors: {}, message: KEEP_IN_TOUCH_INVALID };
  }

  if (!(await setKeepInTouch(id, interval))) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: undefined };
}

// Used on the "Группы" page: a name that is taken is an error there, because
// the aim is a new group.
export async function createGroupAction(
  formData: FormData,
): Promise<ActionResult<"name", { id: number; name: string }>> {
  const parsed = parseGroupName(formData.get("name"));

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const { group, created } = await createGroup(parsed.data);

  if (!created) {
    return {
      ok: false,
      errors: { name: `Группа «${group.name}» уже есть` },
    };
  }

  refresh();

  return { ok: true, data: group };
}

// On the "Группы" page. The new name is checked like a new group's, but the
// group may keep its own name, or change the case of its letters.
export async function renameGroupAction(
  groupId: number,
  formData: FormData,
): Promise<ActionResult<"name", { id: number; name: string }>> {
  const id = parseId(groupId);

  if (id === null) {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  const parsed = parseGroupName(formData.get("name"));

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const result = await renameGroup(id, parsed.data);

  if (result.status === "not_found") {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  if (result.status === "taken") {
    return {
      ok: false,
      errors: { name: `Группа «${result.group.name}» уже есть` },
    };
  }

  refresh();

  return { ok: true, data: result.group };
}

// Deleting a group keeps its contacts. There is no "Вернуть": the dialog that
// asks first is the protection.
export async function deleteGroupAction(
  groupId: number,
): Promise<ActionResult<never, { id: number; name: string }>> {
  const id = parseId(groupId);
  const group = id === null ? undefined : await deleteGroup(id);

  if (!group) {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: group };
}

// A tick in the group list of the contact card. Saved at once, one group at a
// time. `member` is true for a tick put, false for a tick removed.
export async function setContactGroupAction(
  contactId: number,
  groupId: number,
  member: boolean,
): Promise<ActionResult<never>> {
  const contact = parseId(contactId);
  const group = parseId(groupId);

  if (contact === null) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  if (group === null) {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  const result = await setContactGroup(contact, group, member === true);

  if (result === "contact_not_found") {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  if (result === "group_not_found") {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: undefined };
}

// The "Новая группа" field in the contact card: makes the group and puts the
// contact into it. A name that is taken is not an error here: the contact goes
// into the group that has it, because that is what was asked for.
export async function createGroupForContactAction(
  contactId: number,
  formData: FormData,
): Promise<ActionResult<"name", { id: number; name: string }>> {
  const contact = parseId(contactId);

  if (contact === null || !(await getContact(contact))) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  const parsed = parseGroupName(formData.get("name"));

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const { group } = await createGroup(parsed.data);
  const result = await setContactGroup(contact, group.id, true);

  if (result === "contact_not_found") {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  if (result === "group_not_found") {
    return { ok: false, errors: {}, message: GROUP_NOT_FOUND };
  }

  refresh();

  return { ok: true, data: group };
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

// "Связались" in the "Пора связаться" block: adds the note "Связались",
// which restarts the deadline. Returns the note for "Отменить".
export async function markContactedAction(
  contactId: number,
): Promise<ActionResult<never, { noteId: number }>> {
  const id = parseId(contactId);

  if (id === null || !(await getContact(id))) {
    return { ok: false, errors: {}, message: CONTACT_NOT_FOUND };
  }

  const note = await addContactedNote(id);

  refresh();

  return { ok: true, data: { noteId: note.id } };
}

export async function undoMarkContactedAction(
  noteId: number,
): Promise<ActionResult<never>> {
  const id = parseId(noteId);

  if (id === null || !(await eraseContactedNote(id))) {
    return { ok: false, errors: {}, message: UNDO_CONTACTED_TOO_LATE };
  }

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
