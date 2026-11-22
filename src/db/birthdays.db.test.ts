import { expect, it } from "vitest";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { getContact, listUpcomingBirthdays } from "@/db/queries";
import { createContactAction, updateContactAction } from "@/app/actions";
import {
  createTestContacts,
  formOf,
  USER_A,
  USER_B,
  signInAs,
} from "../../test/factories";

function person(
  name: string,
  birthDay: number,
  birthMonth: number,
  birthYear: number | null = null,
) {
  return { ownerId: USER_A, name, birthDay, birthMonth, birthYear };
}
const upcoming = (instant: string) =>
  listUpcomingBirthdays(USER_A, new Date(instant));
it("includes today through day six across New Year", async () => {
  await db
    .insert(contacts)
    .values([
      person("Yesterday", 28, 12),
      person("Today", 29, 12, 1990),
      person("Last", 4, 1),
      person("Later", 5, 1),
      person("Future", 4, 1, 2030),
    ]);
  expect(
    (await upcoming("2026-12-29T10:00:00Z")).map((row) => row.name),
  ).toEqual(["Today", "Last"]);
});
it("changes days at Moscow midnight", async () => {
  await db
    .insert(contacts)
    .values([person("Yesterday", 1, 1), person("Last", 8, 1)]);
  expect(
    (await upcoming("2027-01-01T21:00:00Z")).map((row) => row.name),
  ).toEqual(["Last"]);
});
it.each([
  [2028, "02-29"],
  [2027, "02-28"],
] as const)("observes leap birthdays in %i", async (year, day) => {
  await db
    .insert(contacts)
    .values([person("Known", 29, 2, 2000), person("Unknown", 29, 2)]);
  const rows = await upcoming(year + "-02-28T10:00:00Z");
  expect(rows.map((row) => row.day)).toEqual([
    year + "-" + day,
    year + "-" + day,
  ]);
  expect((await getContact(USER_A, rows[0].id))?.birthDay).toBe(29);
});
it("excludes other owners, empty dates and deleted contacts", async () => {
  await db
    .insert(contacts)
    .values([
      person("Mine", 3, 1),
      { ...person("Theirs", 3, 1), ownerId: USER_B },
      { ...person("Deleted", 3, 1), deletedAt: new Date() },
      { name: "Empty", ownerId: USER_A },
    ]);
  expect(
    (await upcoming("2027-01-02T10:00:00Z")).map((row) => row.name),
  ).toEqual(["Mine"]);
});
it("finds birthdays beyond the first hundred", async () => {
  await createTestContacts(
    Array.from({ length: 149 }, (_, i) => ({ name: "А" + i })),
  );
  await db.insert(contacts).values(person("Яна", 3, 1));
  expect(
    (await upcoming("2027-01-02T10:00:00Z")).map((row) => row.name),
  ).toEqual(["Яна"]);
});
it("orders by occurrence, then by the usual alphabet", async () => {
  await db
    .insert(contacts)
    .values([
      person("Борис", 3, 1),
      person("Вера", 2, 1),
      person("Анна", 3, 1),
      person("Алиса", 4, 1),
    ]);
  expect(
    (await upcoming("2027-01-02T10:00:00Z")).map((row) => row.name),
  ).toEqual(["Вера", "Анна", "Борис", "Алиса"]);
});
it("saves and clears parts atomically; old forms preserve them", async () => {
  const form = (year: string) =>
    formOf({ name: "Анна", birthDay: "3", birthMonth: "1", birthYear: year });
  const created = await createContactAction(form(""));
  if (!created.ok) throw new Error("creation failed");
  const id = created.data.id;
  for (const [fields, year] of [
    [form("1990"), 1990],
    [formOf({ name: "Анна" }), 1990],
    [form(""), null],
  ] as const) {
    const before = await getContact(USER_A, id);
    expect(
      await updateContactAction(id, before.updatedAt.toISOString(), fields),
    ).toMatchObject({ ok: true });
    expect(await getContact(USER_A, id)).toMatchObject({
      birthDay: 3,
      birthMonth: 1,
      birthYear: year,
    });
  }
  const saved = await getContact(USER_A, id);
  signInAs(USER_B);
  expect(
    await updateContactAction(id, saved.updatedAt.toISOString(), form("2001")),
  ).toMatchObject({ ok: false });
  signInAs(USER_A);
  expect(
    await updateContactAction(id, new Date(0).toISOString(), form("2001")),
  ).toMatchObject({ ok: false });
  const empty = formOf({
    name: "Анна",
    birthDay: "",
    birthMonth: "",
    birthYear: "",
  });
  expect(
    await updateContactAction(id, saved.updatedAt.toISOString(), empty),
  ).toMatchObject({ ok: true });
  expect(await getContact(USER_A, id)).toMatchObject({
    birthDay: null,
    birthMonth: null,
    birthYear: null,
  });
});
it.each([
  [null, 1, null],
  [1, null, null],
  [null, null, 1990],
  [31, 4, null],
  [29, 2, 1900],
  [1, 1, 0],
])(
  "database rejects inconsistent birthday %s/%s/%s",
  async (birthDay, birthMonth, birthYear) => {
    await expect(
      db.insert(contacts).values({
        ownerId: USER_A,
        name: "Invalid",
        birthDay,
        birthMonth,
        birthYear,
      }),
    ).rejects.toThrow();
  },
);
