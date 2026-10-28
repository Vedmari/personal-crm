import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";
import {
  listContactGroups,
  listContacts,
  listGroups,
  restoreContact,
} from "@/db/queries";
import { eq } from "drizzle-orm";

import { createGroupAction } from "@/app/actions";
import { readListFilter } from "@/lib/read-list-filter";

import {
  createTestContact,
  formOf,
  markContactDeleted,
} from "../../test/factories";

async function makeGroup(name: string): Promise<number> {
  const result = await createGroupAction(formOf({ name }));

  if (!result.ok) {
    throw new Error(`Could not make the group ${name}`);
  }

  return result.data.id;
}

async function put(contactId: number, groupId: number): Promise<void> {
  await db.insert(contactGroups).values({ contactId, groupId });
}

const namesIn = async (search: string, groupId: number | null) =>
  (await listContacts(search, groupId)).items.map((item) => item.name);

describe("listContacts with a group", () => {
  it("shows only the members, and counts only them [Выбрать группу]", async () => {
    const tennis = await makeGroup("Теннис");
    const [anna, boris, vera] = await Promise.all(
      ["Анна", "Борис", "Вера"].map(createTestContact),
    );
    await createTestContact("Глеб");
    await createTestContact("Дарья");
    await Promise.all([anna, boris, vera].map((id) => put(id, tennis)));

    const { items, total } = await listContacts("", tennis);

    expect(items.map((item) => item.name)).toEqual(["Анна", "Борис", "Вера"]);
    expect(total).toBe(3);
  });

  it("still lists everybody when no group is chosen [Вернуться ко всем]", async () => {
    const tennis = await makeGroup("Теннис");
    const anna = await createTestContact("Анна");
    await createTestContact("Борис");
    await put(anna, tennis);

    for (const none of [null, undefined]) {
      const { items, total } = await listContacts("", none);

      expect(items.map((item) => item.name)).toEqual(["Анна", "Борис"]);
      expect(total).toBe(2);
    }
  });

  it("has nobody in a group that nobody joined [В группе никого]", async () => {
    const analysts = await makeGroup("Аналитики");
    await createTestContact("Анна");

    expect(await listContacts("", analysts)).toEqual({
      items: [],
      matched: 0,
      total: 0,
    });
  });

  it("searches inside the group only [Поиск внутри группы]", async () => {
    const friends = await makeGroup("Друзья");
    const smirnova = await createTestContact("Анна Смирнова");
    const petrova = await createTestContact("Анна Петрова");
    const boris = await createTestContact("Борис Иванов");
    await createTestContact("Анна Кузнецова");
    await Promise.all([smirnova, petrova, boris].map((id) => put(id, friends)));

    const { items, total } = await listContacts("анна", friends);

    expect(items.map((item) => item.name)).toEqual([
      "Анна Петрова",
      "Анна Смирнова",
    ]);
    expect(total).toBe(3);
  });

  it("keeps the e and ё rule of the search inside a group [Поиск внутри группы]", async () => {
    const friends = await makeGroup("Друзья");
    const artem = await createTestContact("Артём Белов");
    await put(artem, friends);

    expect(await namesIn("артем", friends)).toEqual(["Артём Белов"]);
  });

  it("finds nobody when the search matches nobody in the group [В группе никого не нашлось]", async () => {
    const friends = await makeGroup("Друзья");
    const boris = await createTestContact("Борис Иванов");
    await createTestContact("Пётр Петров");
    await put(boris, friends);

    expect(await listContacts("петров", friends)).toEqual({
      items: [],
      matched: 0,
      total: 1,
    });
  });

  it("lists a contact of two groups in both of them [Контакт в двух группах]", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const anna = await createTestContact("Анна");
    await put(anna, tennis);
    await put(anna, friends);

    expect(await namesIn("", tennis)).toEqual(["Анна"]);
    expect(await namesIn("", friends)).toEqual(["Анна"]);
    expect((await listContactGroups(anna)).map((group) => group.name)).toEqual([
      "Друзья",
      "Теннис",
    ]);
  });

  it("does not list a contact that waits for «Вернуть» and puts it back after it [Удалила контакт из группы] [Вернула контакт]", async () => {
    const tennis = await makeGroup("Теннис");
    const [anna, boris, vera] = await Promise.all(
      ["Анна", "Борис", "Вера"].map(createTestContact),
    );
    await Promise.all([anna, boris, vera].map((id) => put(id, tennis)));

    await markContactDeleted(boris);

    expect(await listContacts("", tennis)).toMatchObject({ total: 2 });
    expect(await namesIn("", tennis)).toEqual(["Анна", "Вера"]);
    expect((await listGroups())[0].contactCount).toBe(2);

    await restoreContact(boris);

    expect(await listContacts("", tennis)).toMatchObject({ total: 3 });
    expect(await namesIn("", tennis)).toEqual(["Анна", "Борис", "Вера"]);
    expect((await listGroups())[0].contactCount).toBe(3);
  });
});

describe("readListFilter", () => {
  const address = (query: Record<string, string>) =>
    readListFilter(Promise.resolve(query));

  it("reads the chosen group and the search from the address [Ссылка с выбранной группой]", async () => {
    const tennis = await makeGroup("Теннис");

    expect(await address({ group: String(tennis), q: " анна " })).toEqual({
      search: "анна",
      group: { id: tennis, name: "Теннис" },
    });
  });

  it("has no group when the address has none", async () => {
    expect(await address({})).toEqual({ search: "", group: null });
  });

  it("has no group when the group of the address is gone [Группы из адреса больше нет]", async () => {
    const tennis = await makeGroup("Теннис");

    await db.delete(groups).where(eq(groups.id, tennis));

    expect(await address({ group: String(tennis) })).toEqual({
      search: "",
      group: null,
    });
  });

  it("has no group when the address holds nonsense instead of an id", async () => {
    expect(await address({ group: "abc" })).toEqual({
      search: "",
      group: null,
    });
  });
});
