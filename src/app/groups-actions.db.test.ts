import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contactGroups } from "@/db/schema";
import { listGroups } from "@/db/queries";

import {
  createTestContact,
  formOf,
  markContactDeleted,
} from "../../test/factories";
import { createGroupAction } from "./actions";

describe("createGroupAction", () => {
  it("creates a group without the spaces at the ends [Создать группу на странице «Группы»]", async () => {
    const result = await createGroupAction(formOf({ name: " Теннис " }));

    expect(result).toMatchObject({ ok: true, data: { name: "Теннис" } });
    expect(await listGroups()).toEqual([
      expect.objectContaining({ name: "Теннис", contactCount: 0 }),
    ]);
  });

  it("refuses a name that is already taken [Такая группа уже есть]", async () => {
    await createGroupAction(formOf({ name: "Семья" }));

    const result = await createGroupAction(formOf({ name: "СЕМЬЯ" }));

    expect(result).toEqual({
      ok: false,
      errors: { name: "Группа «Семья» уже есть" },
    });
    expect(await listGroups()).toHaveLength(1);
  });

  it("treats е and ё as one letter [«Е» и «ё» считаются одной буквой]", async () => {
    await createGroupAction(formOf({ name: "Ёлка" }));

    const result = await createGroupAction(formOf({ name: "елка" }));

    expect(result).toEqual({
      ok: false,
      errors: { name: "Группа «Ёлка» уже есть" },
    });
    expect(await listGroups()).toHaveLength(1);
  });

  it("does not make a group from an empty name [Пустое название]", async () => {
    for (const name of ["", "   "]) {
      expect(await createGroupAction(formOf({ name }))).toEqual({
        ok: false,
        errors: { name: "Напишите название группы" },
      });
    }

    expect(await listGroups()).toEqual([]);
  });

  it("does not make a group from a name of 51 characters [Слишком длинное название]", async () => {
    const result = await createGroupAction(formOf({ name: "я".repeat(51) }));

    expect(result).toEqual({
      ok: false,
      errors: { name: "Слишком длинно: не больше 50 символов" },
    });
    expect(await listGroups()).toEqual([]);
  });

  it("makes one group when two tabs create the same name at once", async () => {
    const results = await Promise.all([
      createGroupAction(formOf({ name: "Теннис" })),
      createGroupAction(formOf({ name: "теннис" })),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(await listGroups()).toHaveLength(1);
  });
});

describe("listGroups", () => {
  it("has no groups until the user makes one [Групп ещё нет]", async () => {
    expect(await listGroups()).toEqual([]);
  });

  it("lists groups by alphabet, the way a phone book does [Счётчики и порядок кнопок]", async () => {
    for (const name of ["Теннис", "Аналитики", "Ёлка", "Друзья", "Еда"]) {
      await createGroupAction(formOf({ name }));
    }

    expect((await listGroups()).map((group) => group.name)).toEqual([
      "Аналитики",
      "Друзья",
      "Еда",
      "Ёлка",
      "Теннис",
    ]);
  });

  it("counts the contacts of a group, an empty group is 0 [Счётчики и порядок кнопок]", async () => {
    const created = await Promise.all(
      ["Теннис", "Друзья", "Аналитики"].map((name) =>
        createGroupAction(formOf({ name })),
      ),
    );
    const [tennis, friends] = created.map((result) =>
      result.ok ? result.data.id : -1,
    );
    const [anna, boris, vera] = await Promise.all(
      ["Анна", "Борис", "Вера"].map(createTestContact),
    );

    await db.insert(contactGroups).values([
      { contactId: anna, groupId: tennis },
      { contactId: boris, groupId: tennis },
      { contactId: vera, groupId: tennis },
      { contactId: anna, groupId: friends },
    ]);

    expect(
      (await listGroups()).map(({ name, contactCount }) => [
        name,
        contactCount,
      ]),
    ).toEqual([
      ["Аналитики", 0],
      ["Друзья", 1],
      ["Теннис", 3],
    ]);
  });

  it("does not count a contact that waits for «Вернуть» [Удалила контакт из группы]", async () => {
    const result = await createGroupAction(formOf({ name: "Теннис" }));
    const groupId = result.ok ? result.data.id : -1;
    const anna = await createTestContact("Анна");
    const boris = await createTestContact("Борис");

    await db.insert(contactGroups).values([
      { contactId: anna, groupId },
      { contactId: boris, groupId },
    ]);
    await markContactDeleted(boris);

    expect(await listGroups()).toEqual([
      expect.objectContaining({ name: "Теннис", contactCount: 1 }),
    ]);
  });
});
