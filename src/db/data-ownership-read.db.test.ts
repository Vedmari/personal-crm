// openspec/specs/data-ownership: a user reads only their own
// contacts, notes and groups. A's rows are made as A; then B asks.

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createContactAction } from "@/app/actions";
import { db } from "@/db";
import {
  contactPosition,
  deleteContact,
  findGroup,
  getContact,
  getKeepInTouchDue,
  listContactGroups,
  listContacts,
  listGroups,
  listLetters,
  listNotes,
  listOverdueContacts,
} from "@/db/queries";
import { contactGroups, contacts } from "@/db/schema";
import { readListFilter } from "@/lib/read-list-filter";

import {
  addTestNote,
  createTestContact,
  createTestContacts,
  createTestGroup,
  daysAgo,
  formOf,
  setTestKeepInTouch,
  signInAs,
  USER_A,
  USER_B,
} from "../../test/factories";

function names(items: { name: string }[]): string[] {
  return items.map((item) => item.name);
}

describe("own contacts", () => {
  it("a contact added by A is A's and only A's [Добавила контакт]", async () => {
    const result = await createContactAction(formOf({ name: "Анна Смирнова" }));

    expect(result.ok).toBe(true);
    expect(names((await listContacts(USER_A, "")).items)).toEqual([
      "Анна Смирнова",
    ]);

    const [row] = await db
      .select({ ownerId: contacts.ownerId })
      .from(contacts)
      .where(eq(contacts.name, "Анна Смирнова"));

    expect(row.ownerId).toBe(USER_A);
    expect((await listContacts(USER_B, "")).items).toEqual([]);
  });

  it("B's list and search do not have A's contact [Чужого контакта нет в списке и поиске]", async () => {
    await createTestContact("Анна Смирнова", USER_A);
    await createTestContact("Глеб Орлов", USER_B);

    expect(names((await listContacts(USER_B, "")).items)).toEqual([
      "Глеб Орлов",
    ]);
    expect(await listContacts(USER_B, "анна")).toEqual({
      items: [],
      matched: 0,
      total: 1,
    });
    expect(await listLetters(USER_B, "анна")).toEqual([]);
  });

  it("the counter, the letter tabs and the place in the list count only B's [Счётчик и вырубки — по своим]", async () => {
    await createTestContacts(
      [
        { name: "Анна Смирнова" },
        { name: "Борис Петров" },
        { name: "Вера Соколова" },
      ],
      USER_A,
    );
    const gleb = await createTestContact("Глеб Орлов", USER_B);

    const list = await listContacts(USER_B, "");

    expect(list.total).toBe(1);
    expect(list.matched).toBe(1);
    expect(await listLetters(USER_B, "")).toEqual([
      { letter: "Г", position: 1 },
    ]);
    expect(await contactPosition(USER_B, gleb)).toBe(1);
  });

  it("A's contact does not open for B, nor its notes [Прямая ссылка на чужой контакт]", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    await addTestNote(anna, daysAgo(1), "Созвонились");

    expect(await getContact(USER_B, anna)).toBeUndefined();
    expect(await listNotes(USER_B, anna)).toEqual([]);
    expect(await contactPosition(USER_B, anna)).toBeNull();

    // A still has both.
    expect((await getContact(USER_A, anna))?.name).toBe("Анна Смирнова");
    expect(await listNotes(USER_A, anna)).toHaveLength(1);
  });
});

describe("own «Пора связаться»", () => {
  it("A's overdue contact is not in B's block [Чужой просроченный контакт]", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    await setTestKeepInTouch(anna, "month", daysAgo(100));
    const gleb = await createTestContact("Глеб Орлов", USER_B);
    await setTestKeepInTouch(gleb, "month", daysAgo(100));

    expect(names(await listOverdueContacts(USER_B))).toEqual(["Глеб Орлов"]);
    expect(names(await listOverdueContacts(USER_A))).toEqual(["Анна Смирнова"]);
    expect(await getKeepInTouchDue(USER_B, anna)).toBeUndefined();
  });
});

describe("own groups", () => {
  it("A's groups are not on B's page, buttons or card [Чужих групп не видно]", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    const tennis = await createTestGroup("Теннис", USER_A);
    await db.insert(contactGroups).values({ contactId: anna, groupId: tennis });
    await createTestGroup("Семья", USER_B);

    expect(names(await listGroups(USER_B))).toEqual(["Семья"]);
    expect(await listContactGroups(USER_B, anna)).toEqual([]);
    expect(await findGroup(USER_B, tennis)).toBeUndefined();

    expect(await listGroups(USER_A)).toEqual([
      { id: tennis, name: "Теннис", contactCount: 1 },
    ]);
  });

  it("A's group in the address of B's list is like no group [Чужая группа в адресе]", async () => {
    await createTestContact("Анна Смирнова", USER_A);
    const tennis = await createTestGroup("Теннис", USER_A);
    await createTestContact("Глеб Орлов", USER_B);

    signInAs(USER_B);

    const filter = await readListFilter(
      Promise.resolve({ group: String(tennis) }),
    );

    expect(filter).toEqual({ search: "", group: null });
    expect(names((await listContacts(USER_B, "", null)).items)).toEqual([
      "Глеб Орлов",
    ]);
  });
});

describe("erasing old deletions", () => {
  it("B's deletion does not erase A's rows, even deleted ones", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    const gleb = await createTestContact("Глеб Орлов", USER_B);

    // Deleted by A two hours ago: past "Вернуть", waiting to be erased.
    await db
      .update(contacts)
      .set({ deletedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(contacts.id, anna));

    await deleteContact(USER_B, gleb);

    const left = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, anna));

    expect(left).toHaveLength(1);
  });
});
