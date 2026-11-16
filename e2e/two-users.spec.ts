// The success criterion of specs/02-пользователи-вход.md and the scenario
// «A и B не видят данных друг друга» of openspec/specs/
// data-ownership: two people in two browsers, each signed in by the link of
// their own letter, see only their own contacts, notes and groups — both ways.
// Apart from the main scenario, in the "login" project: no kept sign-in.

import { expect, test, type Page } from "@playwright/test";

import { newBrowser, signIn, uniqueEmail } from "./auth";
import { resetDatabase } from "./database";
import { currentPage, notesSection, toast } from "./locators";

const ANNA = "Анна Смирнова";
const GLEB = "Глеб Орлов";
const NOTE = "Обсудили турнир в субботу";

function contactLink(page: Page, name: string) {
  return currentPage(page).getByRole("link", { name: new RegExp(name) });
}

// A chip of the main screen is a link with the name of the group.
function groupChip(page: Page, name: string) {
  return currentPage(page).getByRole("link", { name: new RegExp(`^${name}`) });
}

async function addContact(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  const dialog = page.getByRole("dialog", { name: "Новый контакт" });

  await dialog.getByLabel("Имя").fill(name);
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(contactLink(page, name)).toBeVisible();
}

// Opens the card and returns its address.
async function openCard(page: Page, name: string): Promise<string> {
  await contactLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  return page.url();
}

async function search(page: Page, text: string): Promise<void> {
  await page.getByRole("searchbox").fill(text);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(text)}`));
}

async function expectContactNotFound(page: Page, hidden: string[]) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Контакт не найден" }),
  ).toBeVisible();

  for (const text of hidden) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
}

test.beforeEach(() => resetDatabase());

test("A and B see only their own contacts, notes and groups [A и B не видят данных друг друга]", async ({
  page: a,
  browser,
}) => {
  let annaCard = "";
  let glebCard = "";

  await test.step("A signs in, adds Anna with a note and the group «Друзья»", async () => {
    await signIn(a, uniqueEmail("a"));
    await addContact(a, ANNA);
    annaCard = await openCard(a, ANNA);

    const notes = notesSection(a);

    await notes.getByLabel("Новая заметка").fill(NOTE);
    await notes.getByRole("button", { name: "Добавить заметку" }).click();
    await expect(toast(a, "Заметка сохранена")).toBeVisible();

    await currentPage(a)
      .getByRole("button", { name: /В группу/ })
      .click();

    const picker = a.getByRole("dialog", { name: "Группы контакта" });

    await picker.getByLabel("Название новой группы").fill("Друзья");
    await picker.getByRole("button", { name: "Создать" }).click();
    await expect(
      picker.getByRole("checkbox", { name: "Друзья" }),
    ).toBeChecked();
  });

  const { context, page: b } = await newBrowser(browser);

  try {
    await test.step("B signs in by a link of B's own and adds Gleb", async () => {
      await signIn(b, uniqueEmail("b"));
      await addContact(b, GLEB);
    });

    await test.step("B sees only Gleb: list, search and groups", async () => {
      await b.goto("/");

      await expect(currentPage(b).getByText("1 контакт")).toBeVisible();
      await expect(contactLink(b, GLEB)).toBeVisible();
      await expect(contactLink(b, ANNA)).toHaveCount(0);
      await expect(groupChip(b, "Друзья")).toHaveCount(0);

      await search(b, "Анна");
      await expect(contactLink(b, ANNA)).toHaveCount(0);

      await b.goto("/groups");
      await expect(
        b.getByRole("heading", { level: 1, name: "Группы" }),
      ).toBeVisible();
      await expect(currentPage(b).getByText("Друзья")).toHaveCount(0);
    });

    await test.step("B gets «Контакт не найден» for Anna's card", async () => {
      await b.goto(annaCard);

      await expectContactNotFound(b, [ANNA, NOTE]);
    });

    await test.step("A sees only Anna and not Gleb's card", async () => {
      await b.goto("/");
      glebCard = await openCard(b, GLEB);

      await a.goto("/");

      await expect(currentPage(a).getByText("1 контакт")).toBeVisible();
      await expect(contactLink(a, ANNA)).toBeVisible();
      await expect(contactLink(a, GLEB)).toHaveCount(0);
      await expect(groupChip(a, "Друзья")).toBeVisible();

      await search(a, "Глеб");
      await expect(contactLink(a, GLEB)).toHaveCount(0);

      await a.goto(glebCard);
      await expectContactNotFound(a, [GLEB]);
    });
  } finally {
    await context.close();
  }
});
