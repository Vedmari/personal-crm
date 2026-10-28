import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { listContactGroups, listContacts, listGroups } from "@/db/queries";
import { contactGroups, groups } from "@/db/schema";

import { createTestContact, formOf } from "../../test/factories";
import {
  createGroupAction,
  deleteGroupAction,
  renameGroupAction,
  setContactGroupAction,
} from "./actions";

const GROUP_NOT_FOUND = "Группа не найдена. Обновите страницу.";

async function makeGroup(
  name: string,
  members: string[] = [],
): Promise<number> {
  const result = await createGroupAction(formOf({ name }));

  if (!result.ok) {
    throw new Error(`Could not make the group ${name}`);
  }

  for (const member of members) {
    const contactId = await createTestContact(member);
    await setContactGroupAction(contactId, result.data.id, true);
  }

  return result.data.id;
}

const summary = async () =>
  (await listGroups()).map(({ name, contactCount }) => [name, contactCount]);

describe("the list of groups", () => {
  it("shows every group with its size, by alphabet [Список групп]", async () => {
    await makeGroup("Теннис", ["Анна"]);
    await makeGroup("Друзья", ["Борис", "Вера"]);

    expect(await summary()).toEqual([
      ["Друзья", 2],
      ["Теннис", 1],
    ]);
  });
});

describe("renameGroupAction", () => {
  it("renames the group and keeps its contacts [Переименовать группу]", async () => {
    const id = await makeGroup("Тенис", ["Анна", "Борис", "Вера"]);

    const result = await renameGroupAction(id, formOf({ name: "Теннис" }));

    expect(result).toEqual({ ok: true, data: { id, name: "Теннис" } });
    expect(await summary()).toEqual([["Теннис", 3]]);
    expect((await listContacts("", id)).items).toHaveLength(3);
  });

  it("cuts spaces from the new name", async () => {
    const id = await makeGroup("Тенис");

    await renameGroupAction(id, formOf({ name: "  Теннис " }));

    expect(await summary()).toEqual([["Теннис", 0]]);
  });

  it("refuses an empty name and a name of 51 characters, the group stays as it was", async () => {
    const id = await makeGroup("Теннис");

    expect(await renameGroupAction(id, formOf({ name: "  " }))).toEqual({
      ok: false,
      errors: { name: "Напишите название группы" },
    });
    expect(
      await renameGroupAction(id, formOf({ name: "я".repeat(51) })),
    ).toEqual({
      ok: false,
      errors: { name: "Слишком длинно: не больше 50 символов" },
    });
    expect(await summary()).toEqual([["Теннис", 0]]);
  });

  it("refuses a name that another group has, the group keeps its name [Название занято другой группой]", async () => {
    await makeGroup("Друзья");
    const id = await makeGroup("Приятели");

    const result = await renameGroupAction(id, formOf({ name: "друзья" }));

    expect(result).toEqual({
      ok: false,
      errors: { name: "Группа «Друзья» уже есть" },
    });
    expect((await summary()).map(([name]) => name)).toEqual([
      "Друзья",
      "Приятели",
    ]);
  });

  it("lets a group change only the case of its name [Сменить только регистр]", async () => {
    const id = await makeGroup("теннис", ["Анна"]);

    const result = await renameGroupAction(id, formOf({ name: "Теннис" }));

    expect(result).toEqual({ ok: true, data: { id, name: "Теннис" } });
    expect(await summary()).toEqual([["Теннис", 1]]);
  });

  it("lets a group change е to ё, which is the same name for the check", async () => {
    const id = await makeGroup("Елка");

    const result = await renameGroupAction(id, formOf({ name: "Ёлка" }));

    expect(result).toMatchObject({ ok: true, data: { name: "Ёлка" } });
  });

  it("accepts the name the group already has", async () => {
    const id = await makeGroup("Теннис");

    expect((await renameGroupAction(id, formOf({ name: "Теннис" }))).ok).toBe(
      true,
    );
  });

  it("says the group is gone when it was deleted in another tab [Группу удалили в другой вкладке]", async () => {
    const id = await makeGroup("Теннис");

    await db.delete(groups).where(eq(groups.id, id));

    expect(await renameGroupAction(id, formOf({ name: "Теннис 2" }))).toEqual({
      ok: false,
      errors: {},
      message: GROUP_NOT_FOUND,
    });
    expect(await summary()).toEqual([]);
  });

  it("says the group is gone for an id that is not one", async () => {
    for (const id of [999, -1, 0, "x" as unknown as number]) {
      expect(await renameGroupAction(id, formOf({ name: "Теннис" }))).toEqual({
        ok: false,
        errors: {},
        message: GROUP_NOT_FOUND,
      });
    }
  });
});

describe("deleteGroupAction", () => {
  it("removes the group from the card and keeps the contact in its other groups [Удалить группу]", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const anna = await createTestContact("Анна");
    await setContactGroupAction(anna, tennis, true);
    await setContactGroupAction(anna, friends, true);

    const result = await deleteGroupAction(tennis);

    expect(result).toEqual({ ok: true, data: { id: tennis, name: "Теннис" } });
    expect(await summary()).toEqual([["Друзья", 1]]);
    expect((await listContactGroups(anna)).map((group) => group.name)).toEqual([
      "Друзья",
    ]);
    expect(
      (await listContacts("", null)).items.map((item) => item.name),
    ).toEqual(["Анна"]);
  });

  it("leaves every contact of the group in the book", async () => {
    const id = await makeGroup("Теннис", ["Анна", "Борис", "Вера"]);

    await deleteGroupAction(id);

    expect((await listContacts("", null)).total).toBe(3);
    expect(await db.select().from(contactGroups)).toEqual([]);
  });

  it("leaves the other groups as they were", async () => {
    const tennis = await makeGroup("Теннис", ["Анна"]);
    await makeGroup("Друзья", ["Борис", "Вера"]);

    await deleteGroupAction(tennis);

    expect(await summary()).toEqual([["Друзья", 2]]);
  });

  it("says the group is gone when it was deleted in another tab [Группу уже удалили в другой вкладке]", async () => {
    const id = await makeGroup("Теннис");

    expect((await deleteGroupAction(id)).ok).toBe(true);
    expect(await deleteGroupAction(id)).toEqual({
      ok: false,
      errors: {},
      message: GROUP_NOT_FOUND,
    });
  });

  it("says the group is gone for an id that is not one", async () => {
    for (const id of [999, -1, 0, "x" as unknown as number]) {
      expect(await deleteGroupAction(id)).toEqual({
        ok: false,
        errors: {},
        message: GROUP_NOT_FOUND,
      });
    }
  });
});
