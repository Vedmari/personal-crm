import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { getContact, listContactGroups, listGroups } from "@/db/queries";
import { groups } from "@/db/schema";

import {
  createTestContact,
  formOf,
  markContactDeleted,
} from "../../test/factories";
import {
  createGroupAction,
  createGroupForContactAction,
  setContactGroupAction,
  updateContactAction,
} from "./actions";

const CONTACT_NOT_FOUND = "Контакт не найден. Обновите страницу.";
const GROUP_NOT_FOUND = "Группа не найдена. Обновите страницу.";

async function makeGroup(name: string): Promise<number> {
  const result = await createGroupAction(formOf({ name }));

  if (!result.ok) {
    throw new Error(`Could not make the group ${name}`);
  }

  return result.data.id;
}

const namesOf = async (contactId: number) =>
  (await listContactGroups(contactId)).map((group) => group.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setContactGroupAction", () => {
  it("puts a contact into a group, and a fresh read still shows it [Добавить в группу]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    expect(await setContactGroupAction(anna, tennis, true)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await namesOf(anna)).toEqual(["Теннис"]);
  });

  it("puts a contact into two groups, listed by alphabet [Контакт в двух группах]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");

    await setContactGroupAction(anna, tennis, true);
    await setContactGroupAction(anna, friends, true);

    expect(await namesOf(anna)).toEqual(["Друзья", "Теннис"]);
    expect((await listGroups()).map((group) => group.contactCount)).toEqual([
      1, 1,
    ]);
  });

  it("has no groups for a new contact [Контакт без групп]", async () => {
    const anna = await createTestContact("Анна");

    expect(await namesOf(anna)).toEqual([]);
  });

  it("takes a contact out of a group, the group stays [Убрать из группы]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    await setContactGroupAction(anna, tennis, true);
    const result = await setContactGroupAction(anna, tennis, false);

    expect(result.ok).toBe(true);
    expect(await namesOf(anna)).toEqual([]);
    expect(await listGroups()).toEqual([
      expect.objectContaining({ name: "Теннис", contactCount: 0 }),
    ]);
  });

  it("does not mind a repeated click", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    expect((await setContactGroupAction(anna, tennis, true)).ok).toBe(true);
    expect((await setContactGroupAction(anna, tennis, true)).ok).toBe(true);
    expect(await namesOf(anna)).toEqual(["Теннис"]);

    expect((await setContactGroupAction(anna, tennis, false)).ok).toBe(true);
    expect((await setContactGroupAction(anna, tennis, false)).ok).toBe(true);
    expect(await namesOf(anna)).toEqual([]);
  });

  it("changes one group and leaves the others as they are", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");

    await setContactGroupAction(anna, tennis, true);
    await setContactGroupAction(anna, friends, true);
    await setContactGroupAction(anna, tennis, false);

    expect(await namesOf(anna)).toEqual(["Друзья"]);
  });

  it("does not stop the «Изменить» form that was open in another tab [Форма «Изменить» в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");
    const before = await getContact(anna);

    await setContactGroupAction(anna, tennis, true);

    expect((await getContact(anna))?.updatedAt).toEqual(before?.updatedAt);

    const saved = await updateContactAction(
      anna,
      before!.updatedAt.toISOString(),
      formOf({ name: "Анна Смирнова" }),
    );

    expect(saved).toEqual({ ok: true, data: undefined });
    expect((await getContact(anna))?.name).toBe("Анна Смирнова");
    expect(await namesOf(anna)).toEqual(["Теннис"]);
  });

  it("says the contact is gone when it was deleted in another tab [Контакт удалили в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    await markContactDeleted(anna);

    for (const member of [true, false]) {
      expect(await setContactGroupAction(anna, tennis, member)).toEqual({
        ok: false,
        errors: {},
        message: CONTACT_NOT_FOUND,
      });
    }

    expect((await listGroups())[0].contactCount).toBe(0);
  });

  it("says the contact is gone for an id that is not one", async () => {
    const tennis = await makeGroup("Теннис");

    for (const contactId of [999, -1, 0, Number.NaN, "x" as unknown as number]) {
      expect(await setContactGroupAction(contactId, tennis, true)).toEqual({
        ok: false,
        errors: {},
        message: CONTACT_NOT_FOUND,
      });
    }
  });

  it("says the group is gone when it was deleted in another tab [Группу удалили в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    await db.delete(groups).where(eq(groups.id, tennis));

    for (const member of [true, false]) {
      expect(await setContactGroupAction(anna, tennis, member)).toEqual({
        ok: false,
        errors: {},
        message: GROUP_NOT_FOUND,
      });
    }

    expect(await namesOf(anna)).toEqual([]);
  });

  it("says the group is gone for an id that is not one", async () => {
    const anna = await createTestContact("Анна");

    for (const groupId of [999, -1, 0, "x" as unknown as number]) {
      expect(await setContactGroupAction(anna, groupId, true)).toEqual({
        ok: false,
        errors: {},
        message: GROUP_NOT_FOUND,
      });
    }
  });

  it("fails loudly, not with a quiet success, when the query breaks [Сохранить не получилось]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");

    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("connection lost");
    });

    await expect(setContactGroupAction(anna, tennis, true)).rejects.toThrow(
      "connection lost",
    );
    expect(await namesOf(anna)).toEqual([]);
  });
});

describe("createGroupForContactAction", () => {
  it("makes the group and puts the contact into it [Создать группу из карточки]", async () => {
    const anna = await createTestContact("Анна");

    const result = await createGroupForContactAction(
      anna,
      formOf({ name: "Аналитики" }),
    );

    expect(result).toMatchObject({ ok: true, data: { name: "Аналитики" } });
    expect(await namesOf(anna)).toEqual(["Аналитики"]);
    expect(await listGroups()).toEqual([
      expect.objectContaining({ name: "Аналитики", contactCount: 1 }),
    ]);
  });

  it("puts the contact into the group that has this name, no second group [Группа с таким названием уже есть]", async () => {
    const anna = await createTestContact("Анна");
    await makeGroup("Друзья");

    const result = await createGroupForContactAction(
      anna,
      formOf({ name: "друзья" }),
    );

    expect(result).toMatchObject({ ok: true, data: { name: "Друзья" } });
    expect(await namesOf(anna)).toEqual(["Друзья"]);
    expect(await listGroups()).toHaveLength(1);
  });

  it("keeps the other groups of the contact", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");
    await setContactGroupAction(anna, tennis, true);

    await createGroupForContactAction(anna, formOf({ name: "Аналитики" }));

    expect(await namesOf(anna)).toEqual(["Аналитики", "Теннис"]);
  });

  it("refuses a name of 51 characters and changes nothing [Неподходящее название в карточке]", async () => {
    const anna = await createTestContact("Анна");
    const tennis = await makeGroup("Теннис");
    await setContactGroupAction(anna, tennis, true);

    const result = await createGroupForContactAction(
      anna,
      formOf({ name: "я".repeat(51) }),
    );

    expect(result).toEqual({
      ok: false,
      errors: { name: "Слишком длинно: не больше 50 символов" },
    });
    expect(await namesOf(anna)).toEqual(["Теннис"]);
    expect(await listGroups()).toHaveLength(1);
  });

  it("refuses an empty name and changes nothing [Неподходящее название в карточке]", async () => {
    const anna = await createTestContact("Анна");

    expect(
      await createGroupForContactAction(anna, formOf({ name: "  " })),
    ).toEqual({ ok: false, errors: { name: "Напишите название группы" } });
    expect(await listGroups()).toEqual([]);
  });

  it("makes no group when the contact was deleted in another tab [Контакт удалили в другой вкладке]", async () => {
    const anna = await createTestContact("Анна");

    await markContactDeleted(anna);

    expect(
      await createGroupForContactAction(anna, formOf({ name: "Теннис" })),
    ).toEqual({ ok: false, errors: {}, message: CONTACT_NOT_FOUND });
    expect(await listGroups()).toEqual([]);
  });

  it("says the contact is gone for an id that is not one", async () => {
    for (const contactId of [999, -1, "x" as unknown as number]) {
      expect(
        await createGroupForContactAction(contactId, formOf({ name: "Теннис" })),
      ).toEqual({ ok: false, errors: {}, message: CONTACT_NOT_FOUND });
    }

    expect(await listGroups()).toEqual([]);
  });
});
