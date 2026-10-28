// The paths of openspec/specs/contact-list: the list of the main screen shown
// a hundred at a time. Which rows a portion holds is checked by the `db` tests
// (src/db/list-pages.db.test.ts); here is what only a browser shows.

import { expect, test, type Page } from "@playwright/test";
import type { Sql } from "postgres";

import { resetDatabase, SEEDED_CONTACTS } from "./database";
import { currentPage, toast } from "./locators";

// The book always starts with SEEDED_CONTACTS ("Борис Петров", "Вера
// Соколова"). The others are "Человек 003" … : the number is the place in the
// alphabet, so "Человек 150" is the 150th contact of the list.
const FIRST_PLACE = SEEDED_CONTACTS.length + 1;

const personName = (place: number) =>
  `Человек ${String(place).padStart(3, "0")}`;

type Book = {
  // How many contacts the book has, SEEDED_CONTACTS included.
  size: number;
  about?: (place: number) => string;
  // Places of the contacts in the group "Друзья", when there is one.
  friends?: number[];
};

function book({ size, about = () => "", friends }: Book) {
  return async (sql: Sql) => {
    const people = Array.from(
      { length: size - SEEDED_CONTACTS.length },
      (_, index) => {
        const place = FIRST_PLACE + index;
        return { name: personName(place), about: about(place) };
      },
    );
    const ids: { id: number; name: string }[] = await sql`
      insert into contacts ${sql(people, "name", "about")} returning id, name
    `;

    if (friends) {
      const [group] = await sql<{ id: number }[]>`
        insert into groups (name) values ('Друзья') returning id
      `;
      const members = ids.filter((row) =>
        friends.map(personName).includes(row.name),
      );

      await sql`
        insert into contact_groups ${sql(
          members.map((row) => ({ contact_id: row.id, group_id: group.id })),
          "contact_id",
          "group_id",
        )}
      `;
    }
  };
}

function listRows(page: Page) {
  return currentPage(page).locator("li.contact-row");
}

function listLink(page: Page, name: string) {
  return listRows(page).getByRole("link", { name: new RegExp(name) });
}

function showMore(page: Page) {
  return currentPage(page).getByRole("link", { name: /^Показать ещё/ });
}

function counter(page: Page) {
  return currentPage(page).locator("p[aria-live=polite]");
}

test("the list opens with the first hundred and a button for more [Контактов больше ста]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");

  await expect(listRows(page)).toHaveCount(100);
  await expect(listRows(page).first()).toContainText(SEEDED_CONTACTS[0].name);
  await expect(listRows(page).last()).toContainText(personName(100));
  await expect(showMore(page)).toHaveText("Показать ещё 100");
  await expect(counter(page)).toHaveText("250 контактов");
});

test("a book of a hundred has no button for more [Контактов не больше ста]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 100 }));
  await page.goto("/");

  await expect(listRows(page)).toHaveCount(100);
  await expect(showMore(page)).toHaveCount(0);
});

test("«Показать ещё» adds the next hundred below, keeps the page in place and moves the focus [Следующая сотня]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await showMore(page).scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await showMore(page).click();

  await expect(listRows(page)).toHaveCount(200);
  await expect(showMore(page)).toHaveText("Показать ещё 50");
  await expect(listLink(page, personName(101))).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});

test("the last portion leaves no button [Последняя порция]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/?shown=200");

  await showMore(page).click();

  await expect(listRows(page)).toHaveCount(250);
  await expect(listRows(page).last()).toContainText(personName(250));
  await expect(showMore(page)).toHaveCount(0);
});

test("a letter that spans two portions stands once [Буква на стыке порций]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");

  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(200);

  // The 100th and the 101st are both on "Ч".
  const sections = currentPage(page).locator(
    'section[aria-label="Контакты на букву Ч"]',
  );
  await expect(sections).toHaveCount(1);
  await expect(sections.locator("li.contact-row")).toHaveCount(
    200 - SEEDED_CONTACTS.length,
  );
});

test("a search that finds more than a hundred shows them a hundred at a time [Найдено больше ста]", async ({
  page,
}) => {
  await resetDatabase(
    book({
      size: 250,
      about: (place) => (place < FIRST_PLACE + 150 ? "Соседка" : "Коллега"),
    }),
  );
  await page.goto("/");

  await page.getByRole("searchbox").fill("соседка");

  await expect(counter(page)).toHaveText("Найдено 150 из 250");
  await expect(listRows(page)).toHaveCount(100);
  await expect(showMore(page)).toHaveText("Показать ещё 50");
});

test("a group of more than a hundred is shown a hundred at a time [Группа больше ста]", async ({
  page,
}) => {
  const friends = Array.from(
    { length: 120 },
    (_, index) => FIRST_PLACE + index,
  );
  await resetDatabase(book({ size: 250, friends }));
  await page.goto("/");

  await currentPage(page)
    .getByRole("link", { name: /^Друзья/ })
    .click();

  await expect(counter(page)).toHaveText("В группе «Друзья» — 120 контактов");
  await expect(listRows(page)).toHaveCount(100);
  await expect(showMore(page)).toHaveText("Показать ещё 20");
});

test("a wrong length in the address shows the first hundred [Неверное число в адресе]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));

  await page.goto("/?shown=abc");

  await expect(listRows(page)).toHaveCount(100);
  await expect(showMore(page)).toHaveText("Показать ещё 100");
});

test("the search finds a contact beyond the shown part [Найти контакт за пределами показанных]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await expect(listRows(page)).toHaveCount(100);

  await page.getByRole("searchbox").fill(personName(240));

  await expect(listRows(page)).toHaveCount(1);
  await expect(listLink(page, personName(240))).toBeVisible();
});

test("a new search starts from the first hundred again [Новый запрос начинает сначала]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250, about: () => "Соседка" }));
  await page.goto("/");
  await page.getByRole("searchbox").fill("соседка");
  // The search applies a moment after typing: wait for it, not for the
  // hundred rows that were there before it.
  await expect(counter(page)).toHaveText("Найдено 248 из 250");
  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(200);

  // "1" is in the number of 132 of them: still more than a hundred.
  await page.getByRole("searchbox").fill("соседка 1");

  await expect(counter(page)).toHaveText("Найдено 132 из 250");
  await expect(listRows(page)).toHaveCount(100);
  await expect(showMore(page)).toHaveText("Показать ещё 32");
});

test("a reload keeps the length of the list [Обновить страницу]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(200);

  await page.reload();

  await expect(listRows(page)).toHaveCount(200);
  await expect(showMore(page)).toHaveText("Показать ещё 50");
});

test("«Назад» from a card comes back to the same place of the list [Назад из карточки]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(200);

  await listLink(page, personName(150)).click();
  await expect(
    page.getByRole("heading", { level: 1, name: personName(150) }),
  ).toBeVisible();
  await page.goBack();

  await expect(listRows(page)).toHaveCount(200);
  await expect(listLink(page, personName(150))).toBeInViewport();
});

test("«Показать ещё» adds no steps to the browser history [«Показать ещё» не попадает в историю]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/groups");
  await page.goto("/");

  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(200);
  await showMore(page).click();
  await expect(listRows(page)).toHaveCount(250);
  await page.goBack();

  await expect(page).toHaveURL(/\/groups$/);
});

// revealContact marks the row it scrolled to for a few seconds.
function revealedRow(page: Page, name: string) {
  return listRows(page)
    .filter({ hasText: name })
    .and(page.locator('[data-new="true"]'));
}

test("a new contact beyond the shown part is loaded, scrolled to and lit up [Добавила контакт дальше показанных]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await expect(listRows(page)).toHaveCount(100);

  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill("Ярослава Юдина");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();

  await expect(listRows(page)).toHaveCount(251);
  await expect(revealedRow(page, "Ярослава Юдина")).toBeInViewport();
});

test("a contact brought back beyond the shown part is loaded, scrolled to and lit up [Вернула удалённый контакт]", async ({
  page,
}) => {
  await resetDatabase(book({ size: 250 }));
  await page.goto("/");
  await page.getByRole("searchbox").fill(personName(240));
  await listLink(page, personName(240)).click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page
    .getByRole("dialog", { name: "Удалить контакт?" })
    .getByRole("button", { name: "Удалить" })
    .click();
  await expect(listRows(page)).toHaveCount(100);

  await toast(page, personName(240))
    .getByRole("button", { name: "Вернуть" })
    .click();

  await expect(revealedRow(page, personName(240))).toBeInViewport();
  await expect(listRows(page)).toHaveCount(250);
});
