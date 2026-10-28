// The main paths of openspec/specs/keep-in-touch: the "Пора связаться" block
// on the main screen and the interval in the card. How the deadline is counted
// is checked by the `db` tests (src/db/keep-in-touch.db.test.ts).

import { expect, test, type Page } from "@playwright/test";
import type { Sql } from "postgres";

import type { KeepInTouchInterval } from "../src/db/schema";
import { formatDay, formatNoteDate } from "../src/lib/format";
import { resetDatabase } from "./database";
import { currentPage, notesSection, toast } from "./locators";

type Person = {
  name: string;
  every?: KeepInTouchInterval;
  // Moments of the notes, e.g. "2026-09-10T12:00:00+03:00".
  notes?: string[];
};

// Long before every note: the deadlines count from the notes.
const CHOSEN_LONG_AGO = "2025-01-01T12:00:00+03:00";

const OLD_NOTE = "Обсудили турнир";

function addPeople(people: Person[]) {
  return async (sql: Sql) => {
    for (const person of people) {
      const [{ id }] = await sql<{ id: number }[]>`
        insert into contacts (name, keep_in_touch_every, keep_in_touch_since)
        values (
          ${person.name},
          ${person.every ?? null},
          ${person.every ? CHOSEN_LONG_AGO : null}
        )
        returning id
      `;

      for (const createdAt of person.notes ?? []) {
        await sql`
          insert into notes (contact_id, body, created_at)
          values (${id}, ${OLD_NOTE}, ${createdAt})
        `;
      }
    }
  };
}

function keepInTouchBlock(page: Page) {
  return currentPage(page).locator(
    "section[aria-labelledby=keep-in-touch-heading]",
  );
}

function blockRows(page: Page) {
  return keepInTouchBlock(page).getByRole("listitem");
}

function listLink(page: Page, name: string) {
  return currentPage(page)
    .locator('section[aria-label^="Контакты на букву"]')
    .getByRole("link", { name: new RegExp(name) });
}

function cardHeading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name });
}

test("«Связались» in the block adds the note and restarts the deadline [Отметка из блока]", async ({
  page,
}) => {
  await resetDatabase(
    addPeople([
      {
        name: "Анна Смирнова",
        every: "month",
        notes: ["2026-09-10T12:00:00+03:00"],
      },
    ]),
  );

  await test.step("the overdue contact is in the block and in the list", async () => {
    await page.goto("/");

    await expect(blockRows(page)).toHaveCount(1);
    await expect(blockRows(page).first()).toContainText("Анна Смирнова");
    await expect(blockRows(page).first()).toContainText(
      `Не общались с ${formatDay("2026-09-10")} · раз в месяц`,
    );
    // [Контакт остаётся в алфавитном списке]
    await expect(listLink(page, "Анна Смирнова")).toBeVisible();
  });

  await test.step("«Связались»: still on the main screen, the block is gone", async () => {
    await page
      .getByRole("button", { name: "Связались: Анна Смирнова" })
      .click();

    await expect(
      toast(page, "Анна Смирнова: отметили, что связались"),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(keepInTouchBlock(page)).toBeHidden();
    await expect(listLink(page, "Анна Смирнова")).toBeVisible();
  });

  await test.step("the card has the note «Связались» on top and a new deadline", async () => {
    await listLink(page, "Анна Смирнова").click();

    await expect(cardHeading(page, "Анна Смирнова")).toBeVisible();

    const latest = notesSection(page).locator("ol > li").first();
    const today = formatNoteDate(new Date()).split(" · ")[0];

    await expect(latest).toContainText("Связались");
    await expect(latest).toContainText(today);
    await expect(
      currentPage(page).getByText(/^Связаться не позже /),
    ).toBeVisible();
  });
});

test("the interval chosen in the card is saved at once and puts the contact in the block [Частоту выбрали, а последняя заметка старая]", async ({
  page,
}) => {
  await resetDatabase(
    addPeople([{ name: "Глеб Орлов", notes: ["2026-03-01T12:00:00+03:00"] }]),
  );
  const interval = currentPage(page).getByRole("combobox", {
    name: "Как часто общаться",
  });

  await test.step("nobody is overdue: no block, the card says «Не задано»", async () => {
    await page.goto("/");

    // [Никто не просрочен]
    await expect(listLink(page, "Глеб Орлов")).toBeVisible();
    await expect(keepInTouchBlock(page)).toBeHidden();

    await listLink(page, "Глеб Орлов").click();

    // [По умолчанию частота не задана]
    await expect(cardHeading(page, "Глеб Орлов")).toBeVisible();
    await expect(interval).toContainText("Не задано");
    await expect(
      currentPage(page).getByText(/Связаться не позже|Пора связаться/),
    ).toHaveCount(0);
  });

  await test.step("choose «Раз в квартал»: the deadline is over", async () => {
    await interval.click();
    await page.getByRole("option", { name: "Раз в квартал" }).click();

    await expect(
      currentPage(page).getByText(
        `Пора связаться: срок был ${formatDay("2026-06-01")}`,
      ),
    ).toBeVisible();
  });

  await test.step("reload: the interval is saved [Частота сохраняется без кнопки «Изменить»]", async () => {
    await page.reload();

    await expect(interval).toContainText("Раз в квартал");
  });

  await test.step("the main screen: the contact is in the block, the row opens the card [Переход в карточку]", async () => {
    await page.goto("/");

    await expect(blockRows(page).first()).toContainText(
      `Не общались с ${formatDay("2026-03-01")} · раз в квартал`,
    );

    await keepInTouchBlock(page)
      .getByRole("link", { name: /Глеб Орлов/ })
      .click();

    await expect(cardHeading(page, "Глеб Орлов")).toBeVisible();
  });
});

test("«Отменить» after «Связались» erases the note and puts the contact back [Отменить]", async ({
  page,
}) => {
  await resetDatabase(
    addPeople([
      {
        name: "Анна Смирнова",
        every: "month",
        notes: ["2026-08-01T12:00:00+03:00"],
      },
      {
        name: "Дарья Козлова",
        every: "month",
        notes: ["2026-09-15T12:00:00+03:00"],
      },
    ]),
  );

  await page.goto("/");

  // [Просроченных пять или меньше]
  await expect(blockRows(page)).toHaveCount(2);
  await expect(blockRows(page).first()).toContainText("Анна Смирнова");
  await expect(
    keepInTouchBlock(page).getByRole("button", { name: /Показать все/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Связались: Анна Смирнова" }).click();

  const marked = toast(page, "Анна Смирнова: отметили, что связались");

  await expect(blockRows(page)).toHaveCount(1);
  await marked.getByRole("button", { name: "Отменить" }).click();

  await expect(toast(page, "Отметка снята")).toBeVisible();
  await expect(blockRows(page)).toHaveCount(2);
  await expect(blockRows(page).first()).toContainText("Анна Смирнова");

  await listLink(page, "Анна Смирнова").click();

  await expect(cardHeading(page, "Анна Смирнова")).toBeVisible();
  await expect(notesSection(page).locator("ol > li")).toHaveCount(1);
  await expect(notesSection(page)).not.toContainText("Связались");
});

test("the block shows five contacts and «Показать все» shows the rest [Раскрыть и свернуть]", async ({
  page,
}) => {
  const names = [
    "Алла",
    "Богдан",
    "Валерия",
    "Григорий",
    "Диана",
    "Егор",
    "Жанна",
  ];

  // Equally overdue, so the block goes by the alphabet.
  await resetDatabase(
    addPeople(
      names.map((name) => ({
        name,
        every: "month",
        notes: ["2026-09-10T12:00:00+03:00"],
      })),
    ),
  );

  await page.goto("/");

  const block = keepInTouchBlock(page);

  // [Просроченных больше пяти]
  await expect(blockRows(page)).toHaveCount(5);
  await expect(blockRows(page).last()).toContainText("Диана");

  await block.getByRole("button", { name: "Показать все 7" }).click();

  await expect(blockRows(page)).toHaveCount(7);
  await expect(blockRows(page).last()).toContainText("Жанна");

  await block.getByRole("button", { name: "Свернуть" }).click();

  await expect(blockRows(page)).toHaveCount(5);
  await expect(
    block.getByRole("button", { name: "Показать все 7" }),
  ).toBeVisible();
});
