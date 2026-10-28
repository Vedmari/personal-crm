import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";
import { contactPosition, listContacts } from "@/db/queries";

import {
  createTestContact,
  createTestContacts,
  markContactDeleted,
} from "../../test/factories";

// "Человек 001" … "Человек 250": the number is the place in the alphabet.
const personName = (place: number) =>
  `Человек ${String(place).padStart(3, "0")}`;

// Adds people number 1…count, in reverse order, so that the order of the list
// comes from the names and not from the ids. Returns ids by place: ids[1] is
// the first in the alphabet.
async function addPeople(
  count: number,
  about: (place: number) => string = () => "",
): Promise<number[]> {
  const places = Array.from({ length: count }, (_, index) => count - index);
  const ids = await createTestContacts(
    places.map((place) => ({ name: personName(place), about: about(place) })),
  );
  const byPlace: number[] = [];

  places.forEach((place, index) => {
    byPlace[place] = ids[index];
  });

  return byPlace;
}

const namesOf = (items: { name: string }[]) => items.map((item) => item.name);
const firstPlaces = (count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => personName(from + index));

describe("listContacts in portions", () => {
  it("gives the first hundred in alphabetical order and counts everybody [Контактов больше ста]", async () => {
    await addPeople(250);

    const { items, matched, total } = await listContacts("", null, 100);

    expect(namesOf(items)).toEqual(firstPlaces(100));
    expect(matched).toBe(250);
    expect(total).toBe(250);
  });

  it("gives everybody when there are not more than a hundred [Контактов не больше ста]", async () => {
    await addPeople(100);

    const { items, matched } = await listContacts("", null, 100);

    expect(items).toHaveLength(100);
    expect(matched).toBe(100);
  });

  it("gives the next hundred after the same first hundred [Следующая сотня]", async () => {
    await addPeople(250);

    const first = await listContacts("", null, 100);
    const longer = await listContacts("", null, 200);

    expect(namesOf(longer.items)).toEqual(firstPlaces(200));
    expect(namesOf(longer.items.slice(0, 100))).toEqual(namesOf(first.items));
  });

  it("finds a contact beyond the shown part [Найти контакт за пределами показанных]", async () => {
    await addPeople(250);

    const { items } = await listContacts(personName(240), null, 100);

    expect(namesOf(items)).toEqual([personName(240)]);
  });

  it("gives the first hundred found and counts all found [Найдено больше ста]", async () => {
    await addPeople(250, (place) => (place <= 150 ? "Соседка" : "Коллега"));

    const { items, matched, total } = await listContacts("соседка", null, 100);

    expect(namesOf(items)).toEqual(firstPlaces(100));
    expect(matched).toBe(150);
    expect(total).toBe(250);
  });

  it("gives the first hundred of a big group [Группа больше ста]", async () => {
    const ids = await addPeople(250);
    const [friends] = await db
      .insert(groups)
      .values({ name: "Друзья" })
      .returning({ id: groups.id });
    // Every second person, 1, 3, 5 … 239: 120 members.
    const members = Array.from({ length: 120 }, (_, index) => 2 * index + 1);
    await db.insert(contactGroups).values(
      members.map((place) => ({
        contactId: ids[place],
        groupId: friends.id,
      })),
    );

    const { items, matched, total } = await listContacts("", friends.id, 100);

    expect(namesOf(items)).toEqual(members.slice(0, 100).map(personName));
    expect(matched).toBe(120);
    expect(total).toBe(120);
  });

  it("leaves out a deleted contact waiting for «Вернуть»", async () => {
    const ids = await addPeople(150);
    await markContactDeleted(ids[50]);

    const { items, matched } = await listContacts("", null, 100);

    expect(namesOf(items)).not.toContain(personName(50));
    expect(namesOf(items).at(-1)).toBe(personName(101));
    expect(matched).toBe(149);
  });
});

describe("contactPosition", () => {
  it("is 1 for the first contact in the alphabet", async () => {
    const ids = await addPeople(3);

    expect(await contactPosition(ids[1])).toBe(1);
    expect(await contactPosition(ids[3])).toBe(3);
  });

  it("counts the way the list sorts: word by word", async () => {
    const yakovlev = await createTestContact("Александр Яковлев");
    const belova = await createTestContact("Александра Белова");

    expect(await contactPosition(yakovlev)).toBe(1);
    expect(await contactPosition(belova)).toBe(2);
  });

  it("puts equal names in the order they were added", async () => {
    const first = await createTestContact("Анна Смирнова");
    const second = await createTestContact("Анна Смирнова");

    expect(await contactPosition(first)).toBe(1);
    expect(await contactPosition(second)).toBe(2);
  });

  it("does not count deleted contacts that stand before", async () => {
    const ids = await addPeople(250);
    await markContactDeleted(ids[10]);

    expect(await contactPosition(ids[240])).toBe(239);
  });

  it("is the place in the whole book, whatever group the contact is in", async () => {
    const ids = await addPeople(250);
    const [friends] = await db
      .insert(groups)
      .values({ name: "Друзья" })
      .returning({ id: groups.id });
    await db
      .insert(contactGroups)
      .values({ contactId: ids[240], groupId: friends.id });

    expect(await contactPosition(ids[240])).toBe(240);
  });

  it("is null for a contact that is not in the book", async () => {
    const ids = await addPeople(2);
    await markContactDeleted(ids[2]);

    expect(await contactPosition(ids[2])).toBeNull();
    expect(await contactPosition(999_999)).toBeNull();
  });
});
