// openspec/specs/data-ownership, «Чужое не меняется прямым
// запросом»: B sends every server action with the numbers of A's rows. The
// answer is the one for a row that does not exist, and A's data stay as they
// were.

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addNoteAction,
  createGroupForContactAction,
  deleteContactAction,
  deleteGroupAction,
  deleteNoteAction,
  eraseDeletedContactAction,
  eraseDeletedNoteAction,
  markContactedAction,
  renameGroupAction,
  restoreContactAction,
  restoreNoteAction,
  setContactGroupAction,
  setKeepInTouchAction,
  undoMarkContactedAction,
  updateContactAction,
} from "@/app/actions";
import { db } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";

import {
  addTestNote,
  createTestContact,
  createTestGroup,
  daysAgo,
  formOf,
  signInAs,
  USER_A,
  USER_B,
} from "../../test/factories";

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";
const GROUP_NOT_FOUND = "Группа не найдена. Обновите страницу.";
const NOTE_NOT_FOUND = "Заметка не найдена. Обновите страницу.";

// A number nobody has.
const MISSING = 999_999;

type Book = {
  anna: number;
  deletedBoris: number;
  note: number;
  deletedNote: number;
  contactedNote: number;
  tennis: number;
};

// What A has: Anna with notes and a group, and Boris waiting for «Вернуть».
async function makeBookOfA(): Promise<Book> {
  const anna = await createTestContact("Анна Смирнова", USER_A);
  const deletedBoris = await createTestContact("Борис Петров", USER_A);

  await db
    .update(contacts)
    .set({ deletedAt: new Date() })
    .where(eq(contacts.id, deletedBoris));

  const note = await addTestNote(anna, daysAgo(2), "Обсудили турнир");
  const deletedNote = await addTestNote(anna, daysAgo(1), "Черновик");
  const contactedNote = await addTestNote(anna, new Date(), "Связались");

  await db
    .update(notes)
    .set({ deletedAt: new Date() })
    .where(eq(notes.id, deletedNote));

  const tennis = await createTestGroup("Теннис", USER_A);

  await db.insert(contactGroups).values({ contactId: anna, groupId: tennis });

  return { anna, deletedBoris, note, deletedNote, contactedNote, tennis };
}

// Everything of A that an action could change.
async function snapshotOfA() {
  const [contactRows, noteRows, groupRows, memberRows] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.ownerId, USER_A)),
    db.select().from(notes),
    db.select().from(groups).where(eq(groups.ownerId, USER_A)),
    db.select().from(contactGroups),
  ]);
  const byId = <Row extends { id: number }>(rows: Row[]) =>
    [...rows].sort((left, right) => left.id - right.id);

  return {
    contacts: byId(contactRows),
    notes: byId(noteRows),
    groups: byId(groupRows),
    members: [...memberRows].sort(
      (left, right) =>
        left.contactId - right.contactId || left.groupId - right.groupId,
    ),
  };
}

let book: Book;

beforeEach(async () => {
  book = await makeBookOfA();
  signInAs(USER_B);
});

describe("A's contact", () => {
  it("does not change for B, whatever B sends [Чужой контакт]", async () => {
    const before = await snapshotOfA();
    const [anna] = before.contacts.filter((row) => row.id === book.anna);
    const bGroup = await createTestGroup("Друзья", USER_B);
    const notFound = { ok: false, errors: {}, message: CONTACT_NOT_FOUND };

    expect(
      await updateContactAction(
        book.anna,
        anna.updatedAt.toISOString(),
        formOf({ name: "Чужое имя" }),
      ),
    ).toEqual(notFound);
    expect(await deleteContactAction(book.anna)).toEqual(notFound);
    expect(
      await addNoteAction(book.anna, formOf({ body: "Чужая заметка" })),
    ).toEqual(notFound);
    expect(await markContactedAction(book.anna)).toEqual(notFound);
    expect(await setKeepInTouchAction(book.anna, "week")).toEqual(notFound);
    expect(await setContactGroupAction(book.anna, bGroup, true)).toEqual(
      notFound,
    );
    expect(
      await createGroupForContactAction(book.anna, formOf({ name: "Чужие" })),
    ).toEqual(notFound);

    expect(await snapshotOfA()).toEqual(before);
  });

  it("is not brought back or erased by B, like a contact that is not there [Чужой контакт]", async () => {
    const before = await snapshotOfA();

    expect(await restoreContactAction(book.deletedBoris)).toEqual(
      await restoreContactAction(MISSING),
    );

    await eraseDeletedContactAction(book.deletedBoris);

    expect(await snapshotOfA()).toEqual(before);
  });
});

describe("A's note", () => {
  it("is not deleted, brought back, cancelled or erased by B [Чужая заметка]", async () => {
    const before = await snapshotOfA();

    expect(await deleteNoteAction(book.note)).toEqual({
      ok: false,
      errors: {},
      message: NOTE_NOT_FOUND,
    });
    expect(await restoreNoteAction(book.deletedNote)).toEqual(
      await restoreNoteAction(MISSING),
    );
    expect(await undoMarkContactedAction(book.contactedNote)).toEqual(
      await undoMarkContactedAction(MISSING),
    );

    await eraseDeletedNoteAction(book.deletedNote);

    expect(await snapshotOfA()).toEqual(before);
  });
});

describe("A's group", () => {
  it("is not renamed or deleted by B [Чужая группа]", async () => {
    const before = await snapshotOfA();
    const notFound = { ok: false, errors: {}, message: GROUP_NOT_FOUND };

    expect(
      await renameGroupAction(book.tennis, formOf({ name: "Чужая" })),
    ).toEqual(notFound);
    expect(await deleteGroupAction(book.tennis)).toEqual(notFound);

    expect(await snapshotOfA()).toEqual(before);
  });

  it("does not take B's contact [Свой контакт в чужую группу]", async () => {
    const gleb = await createTestContact("Глеб Орлов", USER_B);
    const before = await snapshotOfA();

    expect(await setContactGroupAction(gleb, book.tennis, true)).toEqual({
      ok: false,
      errors: {},
      message: GROUP_NOT_FOUND,
    });

    expect(await snapshotOfA()).toEqual(before);
    expect(
      await db
        .select()
        .from(contactGroups)
        .where(eq(contactGroups.contactId, gleb)),
    ).toEqual([]);
  });
});

describe("a signed-out request", () => {
  it("changes nothing at all", async () => {
    const before = await snapshotOfA();

    signInAs(null);

    await expect(deleteContactAction(book.anna)).rejects.toThrow();
    await expect(
      addNoteAction(book.anna, formOf({ body: "Без входа" })),
    ).rejects.toThrow();

    expect(await snapshotOfA()).toEqual(before);
  });
});
