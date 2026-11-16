// openspec/specs/notebook: the cover, the bookmark ribbon, the ink and the
// page turns. Which session shows the cover is also checked by the unit tests
// (src/lib/notebook.test.ts).

import { expect, test, type Page } from "@playwright/test";
import type { Sql } from "postgres";

import { newBrowser, signIn, uniqueEmail } from "./auth";
import { resetDatabase } from "./database";
import { currentPage, notesSection, toast } from "./locators";

function cover(page: Page) {
  return page.locator("[data-notebook-cover]");
}

function bookmarkLink(page: Page) {
  return page.getByRole("link", { name: /^Закладка/ });
}

function listLink(page: Page, name: string) {
  return currentPage(page)
    .locator('section[aria-label^="Контакты на букву"]')
    .getByRole("link", { name: new RegExp(name) });
}

function cardHeading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name });
}

function backToList(page: Page) {
  return currentPage(page).getByRole("link", { name: "Все контакты" });
}

// Somebody it is time to contact: once a month, chosen long ago, no notes.
function addOverdue(name: string) {
  return async (sql: Sql, ownerId: string) => {
    await sql`
      insert into contacts (owner_id, name, keep_in_touch_every, keep_in_touch_since)
      values (${ownerId}, ${name}, 'month', '2025-01-01T12:00:00+03:00')
    `;
  };
}

function addNote(contactName: string, body: string) {
  return async (sql: Sql) => {
    await sql`
      insert into notes (contact_id, body)
      select id, ${body} from contacts where name = ${contactName}
    `;
  };
}

// Writes down every view transition the page starts: its types and the
// animations that run in it.
async function recordPageTurns(page: Page) {
  await page.addInitScript(() => {
    const turns: { types: string[]; animations: string[] }[] = [];
    Object.assign(window, { pageTurns: turns });

    const start = document.startViewTransition?.bind(document);

    if (!start) {
      return;
    }

    document.startViewTransition = ((
      options: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      const transition = start(options);
      const turn = {
        types: typeof options === "function" ? [] : [...(options.types ?? [])],
        animations: [] as string[],
      };

      turns.push(turn);
      transition.ready
        .then(() => {
          turn.animations = document
            .getAnimations()
            .map((animation) => (animation as CSSAnimation).animationName)
            .filter(Boolean);
        })
        .catch(() => {});

      return transition;
    }) as typeof document.startViewTransition;
  });
}

function pageTurns(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          pageTurns: { types: string[]; animations: string[] }[];
        }
      ).pageTurns,
  );
}

async function forgetPageTurns(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { pageTurns: unknown[] }).pageTurns.length = 0;
  });
}

// Counts every strike of the pen on the page, even one that is gone already.
async function countInk(page: Page) {
  await page.addInitScript(() => {
    Object.assign(window, { inkStrokes: 0 });
    new MutationObserver((records) => {
      for (const record of records) {
        if ((record.target as Element).getAttribute("data-ink") === "struck") {
          (window as unknown as { inkStrokes: number }).inkStrokes += 1;
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ink"],
    });
  });
}

test.describe("cover", () => {
  // A new browser session of the signed-in e2e user: without the session
  // cookie of the cover, so the cover is closed on the first page.
  test.beforeEach(async ({ context }) => {
    await context.clearCookies({ name: "notebook-opened" });
  });

  test("the cover opens by itself the first time [Первое открытие за сеанс]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");

    await expect(cover(page)).toBeVisible();
    await expect(cover(page)).toBeHidden({ timeout: 5000 });
    await expect(listLink(page, "Борис Петров")).toBeVisible();
  });

  test("no cover after a reload [Повторное открытие в том же сеансе]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");
    await expect(cover(page)).toBeHidden({ timeout: 5000 });

    await page.reload();

    expect(
      await page.evaluate(() => document.documentElement.dataset.cover),
    ).toBeUndefined();
    await expect(cover(page)).toBeHidden();
    await expect(listLink(page, "Борис Петров")).toBeVisible();
  });

  test("the landing opens the cover again [Переход с лендинга]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");
    await expect(cover(page)).toBeHidden({ timeout: 5000 });

    await page.goto("/?from=landing");

    await expect(cover(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(cover(page)).toBeHidden({ timeout: 5000 });
  });

  test("a press opens the cover at once [Нажатие открывает сразу]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");
    await expect(cover(page)).toBeVisible();

    await cover(page).click();

    // The cover takes more than a second by itself.
    await expect(cover(page)).toBeHidden({ timeout: 300 });
    await listLink(page, "Борис Петров").click();
    await expect(cardHeading(page, "Борис Петров")).toBeVisible();
  });

  test("with reduced motion the cover fades [Обложка растворяется]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(cover(page)).toBeVisible();
    const animations = await cover(page).evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .map((animation) => (animation as CSSAnimation).animationName),
    );
    expect(animations).toEqual(["notebook-cover-fade"]);
    await expect(cover(page)).toBeHidden({ timeout: 2000 });
  });
});

test.describe("bookmark", () => {
  test("the ribbon leads to the last card [Закладка ведёт к последней карточке]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");

    await listLink(page, "Борис Петров").click();
    await expect(cardHeading(page, "Борис Петров")).toBeVisible();
    await backToList(page).click();
    await listLink(page, "Вера Соколова").click();
    await expect(cardHeading(page, "Вера Соколова")).toBeVisible();
    await backToList(page).click();

    await expect(bookmarkLink(page)).toHaveAccessibleName(
      "Закладка: Вера Соколова",
    );
    await bookmarkLink(page).click();
    await expect(cardHeading(page, "Вера Соколова")).toBeVisible();
  });

  test("no link before any card is opened [Карточек ещё не открывали]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");

    await expect(listLink(page, "Борис Петров")).toBeVisible();
    await expect(page.locator("[data-bookmark-ribbon]:visible")).toBeVisible();
    await expect(bookmarkLink(page)).toHaveCount(0);
  });

  test("deleting the bookmarked contact drops the link [Удалила контакт с закладкой]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");

    await listLink(page, "Борис Петров").click();
    await expect(cardHeading(page, "Борис Петров")).toBeVisible();
    await currentPage(page).getByRole("button", { name: "Удалить" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Удалить" })
      .click();

    await expect(listLink(page, "Вера Соколова")).toBeVisible();
    await expect(page.locator("[data-bookmark-ribbon]:visible")).toBeVisible();
    await expect(bookmarkLink(page)).toHaveCount(0);
  });

  // A and B in one browser of their own: the e2e user's kept sign-in is not
  // signed out.
  async function bookmarkAnnaAs(page: Page, email: string) {
    await signIn(page, email);
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    const dialog = page.getByRole("dialog", { name: "Новый контакт" });

    await dialog.getByLabel("Имя").fill("Анна Смирнова");
    await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(dialog).toBeHidden();

    await listLink(page, "Анна Смирнова").click();
    await expect(cardHeading(page, "Анна Смирнова")).toBeVisible();
    await backToList(page).click();
    await expect(bookmarkLink(page)).toHaveAccessibleName(
      "Закладка: Анна Смирнова",
    );
  }

  async function expectNoBookmarkOfAnna(page: Page) {
    await expect(listLink(page, "Анна Смирнова")).toHaveCount(0);
    await expect(page.locator("[data-bookmark-ribbon]:visible")).toBeVisible();
    await expect(bookmarkLink(page)).toHaveCount(0);
    await expect(page.locator('[aria-label*="Анна"]')).toHaveCount(0);
  }

  test("another user in this browser gets no bookmark [В браузере вошёл другой пользователь]", async ({
    browser,
  }) => {
    await resetDatabase();

    const { context, page } = await newBrowser(browser);

    try {
      await bookmarkAnnaAs(page, uniqueEmail("a"));

      await page.getByRole("button", { name: "Выйти" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await signIn(page, uniqueEmail("b"));

      await expectNoBookmarkOfAnna(page);
    } finally {
      await context.close();
    }
  });

  test("another user gets no bookmark even if A did not sign out [В браузере вошёл другой пользователь]", async ({
    browser,
  }) => {
    await resetDatabase();

    const { context, page } = await newBrowser(browser);

    try {
      await bookmarkAnnaAs(page, uniqueEmail("a"));

      // A's sign-in ran out; the bookmark stays in the browser.
      await context.clearCookies({ name: /session_token/ });
      await signIn(page, uniqueEmail("b"));

      await expectNoBookmarkOfAnna(page);
    } finally {
      await context.close();
    }
  });
});

test.describe("ink", () => {
  test("«Связались» strikes the name out [«Связались» зачёркивает строку]", async ({
    page,
  }) => {
    await resetDatabase(addOverdue("Анна Смирнова"));
    await page.goto("/");
    const block = currentPage(page).locator(
      "section[aria-labelledby=keep-in-touch-heading]",
    );
    const row = block
      .getByRole("listitem")
      .filter({ hasText: "Анна Смирнова" });

    await row.getByRole("button", { name: "Связались: Анна Смирнова" }).click();

    await expect(row.and(page.locator('[data-ink="struck"]'))).toBeVisible();
    await expect(row.locator("[data-ink-tick]")).toBeVisible();
    await expect(block).toBeHidden();
    await expect(
      toast(page, "Анна Смирнова: отметили, что связались"),
    ).toBeVisible();
  });

  test("a deleted note is struck out first [Удаление заметки зачёркивает её]", async ({
    page,
  }) => {
    await resetDatabase(addNote("Борис Петров", "Обсудили рассаду"));
    await page.goto("/");
    await listLink(page, "Борис Петров").click();
    const note = notesSection(page)
      .getByRole("listitem")
      .filter({ hasText: "Обсудили рассаду" });

    await note.getByRole("button", { name: /^Удалить заметку/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Удалить" })
      .click();

    await expect(note.and(page.locator('[data-ink="struck"]'))).toBeVisible();
    await expect(note).toHaveCount(0);
    await expect(toast(page, "Заметка будет удалена")).toBeVisible();
  });

  test("a deleted contact's name is struck out first [Удаление контакта зачёркивает имя]", async ({
    page,
  }) => {
    await resetDatabase();
    await page.goto("/");
    await listLink(page, "Борис Петров").click();
    const heading = cardHeading(page, "Борис Петров");
    await expect(heading).toBeVisible();

    await currentPage(page).getByRole("button", { name: "Удалить" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Удалить" })
      .click();

    await expect(
      heading.and(page.locator('[data-ink="struck"]')),
    ).toBeVisible();
    await expect(listLink(page, "Вера Соколова")).toBeVisible();
    await expect(
      toast(page, "Контакт «Борис Петров» будет удалён"),
    ).toBeVisible();
  });
});

test.describe("page turns", () => {
  test("a card and «Группы» turn the page forward [Карточка открывается следующей страницей]", async ({
    page,
  }) => {
    await resetDatabase();
    await recordPageTurns(page);
    await page.goto("/");

    await listLink(page, "Борис Петров").click();
    await expect(cardHeading(page, "Борис Петров")).toBeVisible();
    await expect
      .poll(() => pageTurns(page))
      .toContainEqual({
        types: ["page-forward"],
        animations: expect.arrayContaining(["page-turn-away"]),
      });

    await page.goto("/");
    await forgetPageTurns(page);
    await currentPage(page).getByRole("link", { name: "Группы" }).click();
    await expect(cardHeading(page, "Группы")).toBeVisible();
    await expect
      .poll(() => pageTurns(page))
      .toContainEqual({
        types: ["page-forward"],
        animations: expect.arrayContaining(["page-turn-away"]),
      });
  });

  test("«Все контакты» turns the page back [«Все контакты» листают назад]", async ({
    page,
  }) => {
    await resetDatabase();
    await recordPageTurns(page);

    for (const start of ["/groups", "/"]) {
      await page.goto(start);

      if (start === "/") {
        await listLink(page, "Борис Петров").click();
        await expect(cardHeading(page, "Борис Петров")).toBeVisible();
      }

      await forgetPageTurns(page);
      await backToList(page).click();
      await expect(listLink(page, "Борис Петров")).toBeVisible();
      await expect
        .poll(() => pageTurns(page))
        .toContainEqual({
          types: ["page-back"],
          animations: expect.arrayContaining(["page-turn-in"]),
        });
    }
  });

  test("the browser's Back does not turn the page [Кнопка «Назад» браузера без перелистывания]", async ({
    page,
  }) => {
    await resetDatabase();
    await recordPageTurns(page);
    await page.goto("/");
    await listLink(page, "Борис Петров").click();
    await expect(cardHeading(page, "Борис Петров")).toBeVisible();
    await forgetPageTurns(page);

    await page.goBack();

    await expect(listLink(page, "Борис Петров")).toBeVisible();
    const animations = (await pageTurns(page)).flatMap(
      (turn) => turn.animations,
    );
    expect(animations.filter((name) => name.startsWith("page-turn"))).toEqual(
      [],
    );
  });
});

test("with reduced motion nothing is drawn or turned [Без росчерка и перелистывания]", async ({
  page,
}) => {
  await resetDatabase(addOverdue("Анна Смирнова"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordPageTurns(page);
  await countInk(page);
  await page.goto("/");

  await currentPage(page)
    .getByRole("button", { name: "Связались: Анна Смирнова" })
    .click();
  await expect(
    toast(page, "Анна Смирнова: отметили, что связались"),
  ).toBeVisible();
  await listLink(page, "Борис Петров").click();
  await expect(cardHeading(page, "Борис Петров")).toBeVisible();

  expect(
    await page.evaluate(
      () => (window as unknown as { inkStrokes: number }).inkStrokes,
    ),
  ).toBe(0);
  const animations = (await pageTurns(page)).flatMap((turn) => turn.animations);
  expect(animations.filter((name) => name.startsWith("page-turn"))).toEqual([]);
});
