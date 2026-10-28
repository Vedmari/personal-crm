import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { listLetters } from "@/db/queries";
import { contactGroups, groups } from "@/db/schema";

import { createTestContacts, markContactDeleted } from "../../test/factories";

describe("listLetters", () => {
  it("gives each letter of the list with its first place [Вырубки — буквы книги]", async () => {
    await createTestContacts([
      { name: "Яна Белова", about: "" },
      { name: "Борис Петров", about: "" },
      { name: "Чеслав Ким", about: "" },
      { name: "Вера Соколова", about: "" },
      { name: "Валентин Орлов", about: "" },
      { name: "Ярослав Юдин", about: "" },
    ]);

    expect(await listLetters("", null)).toEqual([
      { letter: "Б", position: 1 },
      { letter: "В", position: 2 },
      { letter: "Ч", position: 4 },
      { letter: "Я", position: 5 },
    ]);
  });

  it("puts «Ё» with «Е» and names that start with no letter under «#»", async () => {
    await createTestContacts([
      { name: "Ёлкин Пётр", about: "" },
      { name: "Егор Ли", about: "" },
      { name: "3D-печать Миша", about: "" },
    ]);

    const letters = await listLetters("", null);

    expect(letters.map((item) => item.letter)).toEqual(["#", "Е"]);
    expect(letters[1].position).toBe(2);
  });

  it("follows the search [Вырубки следуют за поиском]", async () => {
    await createTestContacts([
      { name: "Борис Яковлев", about: "" },
      { name: "Яков Белов", about: "" },
      { name: "Вера Соколова", about: "" },
    ]);

    expect(await listLetters("яков белов", null)).toEqual([
      { letter: "Я", position: 1 },
    ]);
    expect(await listLetters("яков", null)).toEqual([
      { letter: "Б", position: 1 },
      { letter: "Я", position: 2 },
    ]);
  });

  it("counts only the people of the chosen group", async () => {
    const [boris, , yana] = await createTestContacts([
      { name: "Борис Петров", about: "" },
      { name: "Вера Соколова", about: "" },
      { name: "Яна Белова", about: "" },
    ]);
    const [group] = await db
      .insert(groups)
      .values({ name: "Друзья" })
      .returning({ id: groups.id });
    await db.insert(contactGroups).values([
      { contactId: boris, groupId: group.id },
      { contactId: yana, groupId: group.id },
    ]);

    expect(await listLetters("", group.id)).toEqual([
      { letter: "Б", position: 1 },
      { letter: "Я", position: 2 },
    ]);
  });

  it("leaves deleted contacts out", async () => {
    const [, vera] = await createTestContacts([
      { name: "Борис Петров", about: "" },
      { name: "Вера Соколова", about: "" },
      { name: "Яна Белова", about: "" },
    ]);
    await markContactDeleted(vera);

    expect(await listLetters("", null)).toEqual([
      { letter: "Б", position: 1 },
      { letter: "Я", position: 2 },
    ]);
  });
});
