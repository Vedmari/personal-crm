import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  getContact,
  getKeepInTouchDue,
  listNotes,
  listOverdueContacts,
} from "@/db/queries";
import { notes } from "@/db/schema";

import {
  addTestNote,
  createTestContact,
  daysAgo,
  formOf,
  markContactDeleted,
  setTestKeepInTouch,
} from "../../test/factories";
import {
  deleteNoteAction,
  markContactedAction,
  setKeepInTouchAction,
  undoMarkContactedAction,
  updateContactAction,
} from "./actions";

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";

const overdueNames = async () =>
  (await listOverdueContacts()).map((contact) => contact.name);

// An overdue contact with one note, for the "Пора связаться" block.
async function createOverdueContact(name: string): Promise<number> {
  const id = await createTestContact(name);
  await setTestKeepInTouch(id, "month", daysAgo(400));
  await addTestNote(id, daysAgo(40));

  return id;
}

async function markContacted(contactId: number): Promise<number> {
  const result = await markContactedAction(contactId);

  if (!result.ok) {
    throw new Error(`Could not mark ${contactId} as contacted`);
  }

  return result.data.noteId;
}

describe("setKeepInTouchAction", () => {
  it("has no interval for a new contact [По умолчанию частота не задана]", async () => {
    const anna = await createTestContact("Анна");

    expect((await getContact(anna))?.keepInTouchEvery).toBeNull();
  });

  it("saves the interval at once, and a fresh read still shows it [Частота сохраняется без кнопки «Изменить»]", async () => {
    const anna = await createTestContact("Анна");

    expect(await setKeepInTouchAction(anna, "month")).toEqual({
      ok: true,
      data: undefined,
    });
    expect((await getContact(anna))?.keepInTouchEvery).toBe("month");
  });

  it("clears the interval for «Не задано»", async () => {
    const anna = await createTestContact("Анна");
    await setKeepInTouchAction(anna, "month");

    await setKeepInTouchAction(anna, null);

    expect((await getContact(anna))?.keepInTouchEvery).toBeNull();
    expect(await getKeepInTouchDue(anna)).toBeUndefined();
  });

  it("restarts the count when a different interval is chosen [Частоту сменили у контакта без заметок]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(
      anna,
      "year",
      new Date("2026-09-01T12:00:00+03:00"),
    );
    const before = Date.now();

    await setKeepInTouchAction(anna, "month");

    const since = (await getContact(anna))?.keepInTouchSince;

    expect(since?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect((await getKeepInTouchDue(anna))?.overdueDays).toBeLessThan(0);
  });

  it("keeps the count when the same interval is chosen again", async () => {
    const anna = await createTestContact("Анна");
    const chosen = new Date("2026-09-01T12:00:00+03:00");
    await setTestKeepInTouch(anna, "month", chosen);

    await setKeepInTouchAction(anna, "month");

    expect((await getContact(anna))?.keepInTouchSince).toEqual(chosen);
  });

  it("lets the edit form of another tab save, and keeps the new interval [Смена частоты не мешает форме «Изменить» в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");
    const before = await getContact(anna);

    await setKeepInTouchAction(anna, "month");

    const saved = await updateContactAction(
      anna,
      before!.updatedAt.toISOString(),
      formOf({ name: "Анна Смирнова" }),
    );

    expect(saved).toEqual({ ok: true, data: undefined });

    const after = await getContact(anna);

    expect(after?.name).toBe("Анна Смирнова");
    expect(after?.keepInTouchEvery).toBe("month");
  });

  it("says the contact is gone when it was deleted in another tab [Контакт удалили в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");
    await markContactDeleted(anna);

    expect(await setKeepInTouchAction(anna, "month")).toEqual({
      ok: false,
      errors: {},
      message: CONTACT_NOT_FOUND,
    });
  });
});

describe("markContactedAction", () => {
  it("adds the note «Связались» on top and takes the contact out of the block [Отметка из блока]", async () => {
    const anna = await createOverdueContact("Анна Смирнова");

    await markContacted(anna);

    expect((await listNotes(anna)).map((note) => note.body)).toEqual([
      "Связались",
      "Созвонились",
    ]);
    expect(await overdueNames()).toEqual([]);
    expect((await getKeepInTouchDue(anna))?.overdueDays).toBeLessThan(0);
  });

  it("counts from the previous note again once «Связались» is deleted [Заметка «Связались» — обычная заметка]", async () => {
    const anna = await createOverdueContact("Анна");
    const dueBefore = (await getKeepInTouchDue(anna))?.dueDay;
    const noteId = await markContacted(anna);

    expect(await deleteNoteAction(noteId)).toEqual({
      ok: true,
      data: undefined,
    });
    expect((await getKeepInTouchDue(anna))?.dueDay).toBe(dueBefore);
    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("says the contact is gone and adds no note when it was deleted in another tab [«Связались» у контакта, удалённого в другой вкладке]", async () => {
    const anna = await createOverdueContact("Анна");
    await markContactDeleted(anna);

    expect(await markContactedAction(anna)).toEqual({
      ok: false,
      errors: {},
      message: CONTACT_NOT_FOUND,
    });
    expect(await listNotes(anna)).toHaveLength(1);
  });
});

describe("undoMarkContactedAction", () => {
  it("erases the note «Связались» for good and puts the contact back in the block [Отменить]", async () => {
    const anna = await createOverdueContact("Анна");
    const noteId = await markContacted(anna);

    expect(await undoMarkContactedAction(noteId)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await db.select().from(notes).where(eq(notes.id, noteId))).toEqual(
      [],
    );
    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("does not erase an ordinary note", async () => {
    const anna = await createTestContact("Анна");
    const noteId = await addTestNote(anna, daysAgo(1));

    const result = await undoMarkContactedAction(noteId);

    expect(result.ok).toBe(false);
    expect(await listNotes(anna)).toHaveLength(1);
  });
});
