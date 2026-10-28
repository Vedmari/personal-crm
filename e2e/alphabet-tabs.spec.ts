// The alphabet tabs of openspec/specs/contact-list. Which letters and places
// they get is checked by the `db` tests (src/db/list-letters.db.test.ts).

import { expect, test, type Page } from "@playwright/test";
import type { Sql } from "postgres";

import { resetDatabase, SEEDED_CONTACTS } from "./database";
import { currentPage } from "./locators";

// SEEDED_CONTACTS give «Б» and «В» (places 1 and 2), then «Человек 003» …
// «Человек 239» and «Яна 240» … «Яна 250»: the number is the place in the
// alphabet, and the people on «Я» start at the 240th place.
const FIRST_YA = 240;
const SIZE = 250;

function book() {
  return async (sql: Sql) => {
    const people = Array.from(
      { length: SIZE - SEEDED_CONTACTS.length },
      (_, index) => {
        const place = SEEDED_CONTACTS.length + 1 + index;
        const number = String(place).padStart(3, "0");
        return {
          name: place < FIRST_YA ? `Человек ${number}` : `Яна ${number}`,
        };
      },
    );

    await sql`insert into contacts ${sql(people, "name")}`;
  };
}

function tabs(page: Page) {
  return page.locator("nav[aria-label='Алфавит']:visible");
}

function tab(page: Page, letter: string) {
  return tabs(page).getByRole("link", { name: letter, exact: true });
}

function letterSection(page: Page, letter: string) {
  return currentPage(page).locator(
    `section[aria-label="Контакты на букву ${letter}"]`,
  );
}

function listRows(page: Page) {
  return currentPage(page).locator("li.contact-row");
}

test("the tabs hold the letters of the book [Вырубки — буквы книги]", async ({
  page,
}) => {
  await resetDatabase(book());
  await page.goto("/");

  await expect(tabs(page).getByRole("link")).toHaveText(["Б", "В", "Ч", "Я"]);
});

test("a letter on the page scrolls to it [Буква в показанной части]", async ({
  page,
}) => {
  await resetDatabase(book());
  await page.goto("/");
  await expect(listRows(page)).toHaveCount(100);
  await page.mouse.wheel(0, 3000);

  await tab(page, "В").click();

  await expect(letterSection(page, "В").locator("li").first()).toBeInViewport();
  await expect(listRows(page)).toHaveCount(100);
  await expect(page).not.toHaveURL(/shown=/);
});

test("a letter further on loads the list up to it [Буква дальше показанных]", async ({
  page,
}) => {
  await resetDatabase(book());
  await page.goto("/");
  await expect(listRows(page)).toHaveCount(100);

  await tab(page, "Я").click();

  await expect(listRows(page)).toHaveCount(SIZE);
  await expect(page).toHaveURL(/shown=300/);
  await expect(letterSection(page, "Я").locator("li").first()).toBeInViewport();
});

test("the tabs follow the search [Вырубки следуют за поиском]", async ({
  page,
}) => {
  await resetDatabase(async (sql) => {
    await sql`insert into contacts (name) values ('Яков Белов')`;
  });

  await page.goto(`/?q=${encodeURIComponent("Яков")}`);

  await expect(listRows(page)).toHaveCount(1);
  await expect(tabs(page).getByRole("link")).toHaveText(["Я"]);
});

test("Back from a card returns to the letter [Назад из карточки после перехода по букве]", async ({
  page,
}) => {
  await resetDatabase(book());
  await page.goto("/");
  await tab(page, "Я").click();
  await expect(letterSection(page, "Я").locator("li").first()).toBeInViewport();

  await letterSection(page, "Я").getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Яна ${FIRST_YA}`,
  );
  await page.goBack();

  await expect(listRows(page)).toHaveCount(SIZE);
  await expect(letterSection(page, "Я").locator("li").first()).toBeInViewport();
});

test("a letter adds no step to the history [Переход по букве не попадает в историю]", async ({
  page,
}) => {
  await resetDatabase(book());
  await page.goto("/groups");
  await page.goto("/");

  await tab(page, "Я").click();
  await expect(page).toHaveURL(/shown=300/);
  await page.goBack();

  await expect(page).toHaveURL(/\/groups$/);
});
