import { expect, test, type Page } from "@playwright/test";
import { resetDatabase } from "./database";
import { currentPage } from "./locators";

function moscowDay(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(Date.now() + offset * 86400000));
  return {
    day: String(Number(parts.find((p) => p.type === "day")!.value)),
    month: String(Number(parts.find((p) => p.type === "month")!.value)),
  };
}
const block = (page: Page) =>
  currentPage(page).getByRole("region", { name: "Скоро день рождения" });
async function add(page: Page, day: string, month: string, year: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Имя").fill("Анна");
  await dialog.getByLabel("День", { exact: true }).fill(day);
  await dialog.getByLabel("Месяц", { exact: true }).fill(month);
  await dialog.getByLabel("Год", { exact: false }).fill(year);
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(dialog).toBeHidden();
}
async function edit(page: Page) {
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  return page.getByRole("dialog");
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toBeHidden();
}
test.beforeEach(async () => {
  await resetDatabase();
});
test("creates a contact with no birthday", async ({ page }) => {
  await add(page, "", "", "");
  await currentPage(page).getByRole("link", { name: /Анна/ }).click();
  await expect(
    (await edit(page)).getByLabel("День", { exact: true }),
  ).toHaveValue("");
});
test("opens the birthday card with an unknown year", async ({ page }) => {
  const { day, month } = moscowDay();
  await add(page, day, month, "");
  await block(page).getByRole("link", { name: /Анна/ }).click();
  await expect(
    currentPage(page).getByRole("heading", { name: "Анна", exact: true }),
  ).toBeVisible();
  const dialog = await edit(page);
  await expect(dialog.getByLabel("Год")).toHaveValue("");
  await expect(dialog.getByLabel("День", { exact: true })).toHaveValue(day);
});
test("birthday links lead to the selected person's card", async ({ page }) => {
  const { day, month } = moscowDay();
  await resetDatabase(async (sql) => {
    await sql`update contacts set birth_day=${Number(day)},birth_month=${Number(month)}`;
  });
  await page.goto("/");
  await block(page)
    .getByRole("link", { name: /Вера Соколова/ })
    .click();
  await expect(
    currentPage(page).getByRole("heading", {
      name: "Вера Соколова",
      exact: true,
    }),
  ).toBeVisible();
});
test("keeps a complete birthday after reopening the card", async ({ page }) => {
  await add(page, "3", "1", "1990");
  await currentPage(page)
    .getByRole("region", { name: "Контакты на букву А" })
    .getByRole("link", { name: "Анна" })
    .click();
  await expect(
    currentPage(page).getByRole("heading", { name: "Анна", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    currentPage(page).getByText("3 января 1990 года", { exact: true }),
  ).toBeVisible();
  await expect((await edit(page)).getByLabel("Год")).toHaveValue("1990");
});
test("adds and removes only the birth year", async ({ page }) => {
  await add(page, "3", "1", "");
  await currentPage(page)
    .getByRole("region", { name: "Контакты на букву А" })
    .getByRole("link", { name: "Анна" })
    .click();
  for (const [year, caption] of [
    ["1990", "3 января 1990 года"],
    ["", "3 января"],
  ]) {
    await (await edit(page)).getByLabel("Год").fill(year);
    await save(page);
    await expect(
      currentPage(page).getByText(caption, { exact: true }),
    ).toBeVisible();
  }
});
test("legacy contact has an empty birthday", async ({ page }) => {
  await page.goto("/");
  await currentPage(page)
    .getByRole("link", { name: /Борис Петров/ })
    .click();
  const dialog = await edit(page);
  for (const label of ["День", "Месяц", "Год"])
    await expect(dialog.getByLabel(label)).toHaveValue("");
});
test("empty week hides the heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    currentPage(page).getByRole("link", { name: /Вера Соколова/ }),
  ).toBeVisible();
  await expect(block(page)).toHaveCount(0);
});
test("correction reorders birthdays and clearing removes the contact", async ({
  page,
}) => {
  const later = moscowDay(2),
    today = moscowDay(),
    tomorrow = moscowDay(1);
  await resetDatabase(async (sql) => {
    await sql`update contacts set birth_day=${Number(tomorrow.day)},birth_month=${Number(tomorrow.month)},keep_in_touch_every='week',keep_in_touch_since=now()-interval '2 weeks' where name='Борис Петров'`;
  });
  await add(page, later.day, later.month, "");
  const links = block(page).getByRole("link");
  await expect(links.first()).toContainText("Борис");
  await expect(
    currentPage(page).getByRole("heading", { name: "Пора связаться" }),
  ).toBeVisible();
  const alphabet = currentPage(page)
    .getByRole("region", { name: /Контакты на букву/ })
    .getByRole("link");
  await expect(alphabet).toHaveText([/Анна/, /Борис Петров/, /Вера Соколова/]);
  await links.filter({ hasText: "Анна" }).click();
  const dialog = await edit(page);
  await dialog.getByLabel("День", { exact: true }).fill(today.day);
  await dialog.getByLabel("Месяц", { exact: true }).fill(today.month);
  await save(page);
  await page.goto("/");
  await expect(links.first()).toContainText("Анна");
  await links.first().click();
  const form = await edit(page);
  await form.getByLabel("День", { exact: true }).clear();
  await form.getByLabel("Месяц", { exact: true }).clear();
  await save(page);
  await page.goto("/");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText("Борис");
});
test("search and group hide reminders until the plain list returns", async ({
  page,
}) => {
  await resetDatabase(async (sql, owner) => {
    await sql`insert into groups (owner_id,name) values (${owner}, 'Друзья')`;
  });
  const { day, month } = moscowDay();
  await add(page, day, month, "");
  await expect(block(page)).toBeVisible();
  await page.getByRole("searchbox").fill("Анна");
  await expect(block(page)).toBeHidden();
  await page.getByRole("searchbox").clear();
  await expect(block(page)).toBeVisible();
  await page.getByRole("link", { name: /^Друзья/ }).click();
  await expect(block(page)).toBeHidden();
  await page.getByRole("link", { name: "Все", exact: true }).click();
  await expect(block(page)).toBeVisible();
});
