import { describe, expect, it } from "vitest";

import {
  deleteNote,
  getKeepInTouchDue,
  listOverdueContacts,
  restoreContact,
  restoreNote,
} from "@/db/queries";

import {
  addTestNote,
  createTestContact,
  daysAgo,
  markContactDeleted,
  setTestKeepInTouch,
} from "../../test/factories";

// Long before every note of the tests: the deadline counts from notes.
const LONG_AGO = new Date("2025-01-01T12:00:00+03:00");

const dueDayOf = async (contactId: number) =>
  (await getKeepInTouchDue(contactId))?.dueDay;

const overdueNames = async () =>
  (await listOverdueContacts()).map((contact) => contact.name);

describe("getKeepInTouchDue", () => {
  it("has no deadline while the interval is not set [По умолчанию частота не задана]", async () => {
    const anna = await createTestContact("Анна");
    await addTestNote(anna, new Date("2026-09-10T12:00:00+03:00"));

    expect(await getKeepInTouchDue(anna)).toBeUndefined();
  });

  it("counts the deadline from the latest note [Новая заметка запускает срок заново]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", LONG_AGO);
    await addTestNote(anna, new Date("2026-09-10T12:00:00+03:00"));

    expect(await dueDayOf(anna)).toBe("2026-10-10");

    await addTestNote(anna, new Date("2026-10-24T12:00:00+03:00"));

    expect(await dueDayOf(anna)).toBe("2026-11-24");
  });

  it("counts an old note for an interval chosen today [Частоту выбрали, а последняя заметка старая]", async () => {
    const anna = await createTestContact("Анна");
    await addTestNote(anna, new Date("2026-03-01T12:00:00+03:00"));
    await setTestKeepInTouch(
      anna,
      "quarter",
      new Date("2026-10-24T12:00:00+03:00"),
    );

    expect(await dueDayOf(anna)).toBe("2026-06-01");
    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("falls back to the previous note, then to the choice, and back after «Вернуть» [Последнюю заметку удалили]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(
      anna,
      "month",
      new Date("2026-08-01T12:00:00+03:00"),
    );
    const older = await addTestNote(
      anna,
      new Date("2026-09-10T12:00:00+03:00"),
    );
    const newest = await addTestNote(
      anna,
      new Date("2026-10-24T12:00:00+03:00"),
    );

    await deleteNote(newest);
    expect(await dueDayOf(anna)).toBe("2026-10-10");

    await deleteNote(older);
    expect(await dueDayOf(anna)).toBe("2026-09-01");

    await restoreNote(newest);
    expect(await dueDayOf(anna)).toBe("2026-11-24");
  });

  it("counts from the choice when there are no notes [Частоту выбрали у контакта без заметок]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(
      anna,
      "month",
      new Date("2026-10-24T12:00:00+03:00"),
    );

    expect(await dueDayOf(anna)).toBe("2026-11-24");
  });

  it("takes a week as 7 days [Неделя]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "week", LONG_AGO);
    await addTestNote(anna, new Date("2026-10-13T12:00:00+03:00"));

    expect(await dueDayOf(anna)).toBe("2026-10-20");
  });

  it("is not overdue on the deadline day and is 1 day overdue the day after [Неделя]", async () => {
    const onTheDay = await createTestContact("Анна");
    const dayAfter = await createTestContact("Борис");
    await setTestKeepInTouch(onTheDay, "week", LONG_AGO);
    await setTestKeepInTouch(dayAfter, "week", LONG_AGO);
    await addTestNote(onTheDay, daysAgo(7));
    await addTestNote(dayAfter, daysAgo(8));

    expect((await getKeepInTouchDue(onTheDay))?.overdueDays).toBe(0);
    expect((await getKeepInTouchDue(dayAfter))?.overdueDays).toBe(1);
    expect(await overdueNames()).toEqual(["Борис"]);
  });

  it("stops at the end of a short month [Конец месяца]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", LONG_AGO);
    await addTestNote(anna, new Date("2026-01-31T12:00:00+03:00"));

    expect(await dueDayOf(anna)).toBe("2026-02-28");
  });

  it("takes the Moscow day of a note made after midnight [Заметка после полуночи по Москве]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "week", LONG_AGO);
    // Still 24 October in UTC, the time zone of the server.
    await addTestNote(anna, new Date("2026-10-24T22:30:00Z"));

    expect(await dueDayOf(anna)).toBe("2026-11-01");
  });
});

describe("listOverdueContacts", () => {
  it("lists a contact whose deadline is over, with the day of the latest note [Просроченный контакт в блоке]", async () => {
    const anna = await createTestContact("Анна Смирнова");
    await setTestKeepInTouch(anna, "month", LONG_AGO);
    await addTestNote(anna, new Date("2026-09-10T12:00:00+03:00"));

    expect(await listOverdueContacts()).toEqual([
      expect.objectContaining({
        id: anna,
        name: "Анна Смирнова",
        every: "month",
        lastNoteDay: "2026-09-10",
      }),
    ]);
  });

  it("has no day of the latest note for a contact without notes [Просроченный контакт без заметок]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", daysAgo(40));

    expect(await listOverdueContacts()).toEqual([
      expect.objectContaining({ name: "Анна", lastNoteDay: null }),
    ]);
  });

  it("drops a contact after a new note [Новая заметка запускает срок заново]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", LONG_AGO);
    await addTestNote(anna, daysAgo(40));

    expect(await overdueNames()).toEqual(["Анна"]);

    await addTestNote(anna, new Date());

    expect(await overdueNames()).toEqual([]);
  });

  it("skips a contact without an interval, however old the notes [Контакт без частоты]", async () => {
    const anna = await createTestContact("Анна");
    await addTestNote(anna, LONG_AGO);

    expect(await overdueNames()).toEqual([]);
  });

  it("skips a deleted contact and lists it again after «Вернуть» [Удалённый контакт]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", LONG_AGO);

    await markContactDeleted(anna);
    expect(await overdueNames()).toEqual([]);

    await restoreContact(anna);
    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("is empty when nobody is overdue [Никто не просрочен]", async () => {
    const anna = await createTestContact("Анна");
    await setTestKeepInTouch(anna, "month", LONG_AGO);
    await addTestNote(anna, daysAgo(3));
    await createTestContact("Борис");

    expect(await listOverdueContacts()).toEqual([]);
  });

  it("puts the most overdue first, whatever the interval [Больше дней просрочки — выше]", async () => {
    const weekly = await createTestContact("Анна");
    const yearly = await createTestContact("Борис");
    await setTestKeepInTouch(weekly, "week", LONG_AGO);
    await setTestKeepInTouch(yearly, "year", LONG_AGO);
    await addTestNote(weekly, daysAgo(7 + 3));
    // About 30 days: a year is 12 calendar months, not 365 days.
    await addTestNote(yearly, daysAgo(365 + 30));

    const overdue = await listOverdueContacts();

    expect(overdue.map((contact) => contact.name)).toEqual(["Борис", "Анна"]);
    expect(overdue[0].overdueDays).toBeGreaterThan(25);
    expect(overdue[1].overdueDays).toBe(3);
  });

  it("puts equally overdue contacts in alphabetical order [Равная просрочка]", async () => {
    const boris = await createTestContact("Борис");
    const anna = await createTestContact("Анна");

    for (const id of [boris, anna]) {
      await setTestKeepInTouch(id, "week", LONG_AGO);
      await addTestNote(id, daysAgo(7 + 5));
    }

    expect(await overdueNames()).toEqual(["Анна", "Борис"]);
  });
});
