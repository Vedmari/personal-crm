// The main scenario of specs/01-продуктовая-идея.md, end to end: a real
// browser, the real app and a real database (the e2e one, see e2e/database.ts).

import { expect, test, type Page } from "@playwright/test";

import { resetDatabase, SEEDED_CONTACTS } from "./database";
import { currentPage, notesSection, toast } from "./locators";

const NEW_CONTACT = { name: "Анна Смирнова", about: "Тренер по теннису" };
const NOTE = "Созвонились: в субботу играем в теннис на Соколе";

const ALL_NAMES = [NEW_CONTACT, ...SEEDED_CONTACTS].map(
  (contact) => contact.name,
);

function contactLink(page: Page, name: string) {
  return currentPage(page).getByRole("link", { name: new RegExp(name) });
}

test.beforeEach(() => resetDatabase());

test("a contact added, found and noted keeps the note for every browser [Главный сценарий]", async ({
  page,
  browser,
  baseURL,
}) => {
  await test.step("open: the list shows all contacts", async () => {
    await page.goto("/");

    await expect(currentPage(page).getByText("2 контакта")).toBeVisible();

    for (const contact of SEEDED_CONTACTS) {
      await expect(contactLink(page, contact.name)).toBeVisible();
    }
  });

  await test.step("add a contact: it appears in the list", async () => {
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    const dialog = page.getByRole("dialog", { name: "Новый контакт" });

    await dialog.getByLabel("Имя").fill(NEW_CONTACT.name);
    await dialog.getByLabel("Кто это").fill(NEW_CONTACT.about);
    await dialog.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(currentPage(page).getByText("3 контакта")).toBeVisible();
    await expect(contactLink(page, NEW_CONTACT.name)).toBeVisible();
  });

  await test.step("find the contact by name and open the card", async () => {
    await page.getByRole("searchbox").fill("смирнова");

    await expect(currentPage(page).getByText("Найдено 1 из 3")).toBeVisible();
    await expect(contactLink(page, SEEDED_CONTACTS[0].name)).toHaveCount(0);

    await contactLink(page, NEW_CONTACT.name).click();

    await expect(
      page.getByRole("heading", { level: 1, name: NEW_CONTACT.name }),
    ).toBeVisible();
  });

  await test.step("add a note after the conversation", async () => {
    const notes = notesSection(page);

    await notes.getByLabel("Новая заметка").fill(NOTE);
    await notes.getByRole("button", { name: "Добавить заметку" }).click();

    await expect(toast(page, "Заметка сохранена")).toBeVisible();
    await expect(
      notes.locator("ol > li").filter({ hasText: NOTE }),
    ).toBeVisible();
  });

  await test.step("reload: the note is saved in the card", async () => {
    await page.reload();

    await expect(
      notesSection(page).locator("ol > li").filter({ hasText: NOTE }),
    ).toBeVisible();
  });

  await test.step("another browser: the same contacts and the same note", async () => {
    // A context of its own: no cookies, storage or cache from the first one.
    const otherBrowser = await browser.newContext({ baseURL });
    const other = await otherBrowser.newPage();

    try {
      await other.goto("/");

      await expect(currentPage(other).getByText("3 контакта")).toBeVisible();

      for (const name of ALL_NAMES) {
        await expect(contactLink(other, name)).toBeVisible();
      }

      await contactLink(other, NEW_CONTACT.name).click();

      await expect(
        notesSection(other).locator("ol > li").filter({ hasText: NOTE }),
      ).toBeVisible();
    } finally {
      await otherBrowser.close();
    }
  });
});
