// openspec/specs/user-auth: the sign-in by a link from a letter,
// in the "login" project — no kept sign-in, every test has emails of its own.
// «Письмо не ушло» is checked by src/app/auth-actions.db.test.ts, «На сервере»
// by a real deploy. Time that cannot be waited for (16 minutes, 30 days) is
// moved in the rows of the e2e database.

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { Sql } from "postgres";

import {
  emailField,
  expectLinkSent,
  getLinkButton,
  newBrowser,
  requestLink,
  signIn,
  uniqueEmail,
} from "./auth";
import { resetDatabase, withDatabase } from "./database";
import { currentPage } from "./locators";
import { countAllLetters, countLettersTo, waitForLetter } from "./mailpit";

const EXPIRED = "Ссылка устарела, запросите новую";
const TOO_OFTEN = "Слишком часто, попробуйте через несколько минут";
const CHECK_EMAIL = "Проверьте адрес почты";

test.beforeEach(() => resetDatabase());

function contactsHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: "Контакты" });
}

async function expectLoginPage(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  await expect(emailField(page)).toBeVisible();
  await expect(getLinkButton(page)).toBeVisible();
  await expect(contactsHeading(page)).toHaveCount(0);
}

async function expectExpiredPage(page: Page) {
  await expect(page).toHaveURL(/\/login\/expired/);
  await expect(page.getByText(EXPIRED)).toBeVisible();
}

// Asks for a link for a fresh address and returns the letter.
async function requestLetter(page: Page, email: string, count = 1) {
  await requestLink(page, email);
  await expectLinkSent(page, email);

  return waitForLetter(email, count);
}

// A request for a link straight to the server, the way a script sends it.
// The Origin of the app is set by hand: anybody can set it, so only the
// checks of the server stand in the way.
function postLinkRequest(
  request: APIRequestContext,
  baseURL: string,
  email: string,
) {
  return request.post("/api/auth/sign-in/magic-link", {
    data: { email },
    headers: { origin: baseURL },
  });
}

function userIdOf(sql: Sql, email: string) {
  return sql`(select id from "user" where email = ${email})`;
}

async function addContactFor(email: string, name: string): Promise<number> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ id: number }[]>`
      insert into contacts (owner_id, name)
      values (${userIdOf(sql, email)}, ${name})
      returning id
    `;

    return row.id;
  });
}

function sessionCookie(cookies: { name: string; expires: number }[]) {
  return cookies.find((cookie) => cookie.name.endsWith("session_token"));
}

const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("without a sign-in", () => {
  test("the main page shows the sign-in form [Открыл приложение без входа]", async ({
    page,
  }) => {
    await page.goto("/");

    await expectLoginPage(page);
    await expect(page.getByText("Борис Петров")).toHaveCount(0);
  });

  test("a card address shows the sign-in form [Прямая ссылка на карточку без входа]", async ({
    page,
  }) => {
    const id = await withDatabase(async (sql) => {
      const [row] = await sql<
        { id: number }[]
      >`select min(id) as id from contacts`;
      return row.id;
    });

    await page.goto(`/contacts/${id}`);

    await expectLoginPage(page);
    await expect(page.getByText("Борис Петров")).toHaveCount(0);
  });

  test("/health answers [Проверка сервера без входа]", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
  });
});

test("a signed-in user is taken from the sign-in page to the list [Вошедший открывает страницу входа]", async ({
  page,
}) => {
  await signIn(page, uniqueEmail("anna"));

  await page.goto("/login");

  await expect(contactsHeading(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test.describe("the link comes by email", () => {
  test("asking for a link sends a letter [Получить ссылку]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await requestLink(page, email);

    await expectLinkSent(page, email);
    expect((await waitForLetter(email)).link).toContain(
      "/api/auth/magic-link/verify",
    );
  });

  test("the answer is the same for a known and a new email [Ответ не выдаёт, есть ли пользователь]", async ({
    page,
  }) => {
    const known = uniqueEmail("known");
    const fresh = uniqueEmail("fresh");

    await signIn(page, known);

    const { context, page: other } = await newBrowser(
      page.context().browser()!,
    );

    try {
      const answers: string[] = [];

      for (const email of [known, fresh]) {
        await requestLink(other, email);
        await expectLinkSent(other, email);

        const status = other.getByRole("status");
        answers.push(
          (await status.textContent())!.replace(email, "<почта>").trim(),
        );
      }

      expect(answers[0]).toBe("Ссылка для входа отправлена на <почта>");
      expect(answers[1]).toBe(answers[0]);
    } finally {
      await context.close();
    }
  });

  test("a new email signs in without a sign-up form [Новая почта]", async ({
    page,
  }) => {
    const email = uniqueEmail("new");
    const letter = await requestLetter(page, email);

    await page.goto(letter.link);

    await expect(contactsHeading(page)).toBeVisible();
    await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
    await expect(page.getByLabel(/Имя/)).toHaveCount(0);
  });

  test("the letter comes from «Личная CRM» with a «Войти» button [Что в письме]", async ({
    page,
  }) => {
    const email = uniqueEmail("letter");
    const letter = await requestLetter(page, email);

    expect(letter.from).toEqual({
      name: "Личная CRM",
      address: "noreply@mail.crm.lichnaya-crm.ru",
    });
    expect(letter.subject).toBe("Вход в Личную CRM");
    expect(letter.text).toContain("15 минут");
    expect(letter.text).toContain(
      "Если вы не запрашивали вход — просто проигнорируйте письмо",
    );

    // The «Войти» button of the HTML version opens the sign-in.
    await page.setContent(letter.html);
    await page.getByRole("link", { name: "Войти" }).click();

    await expect(contactsHeading(page)).toBeVisible();
  });

  test("the letter stays in the mail catcher [На этом компьютере и в автотестах]", async ({
    page,
  }) => {
    const email = uniqueEmail("nobody");
    const letter = await requestLetter(page, email);

    await page.goto(letter.link);

    await expect(contactsHeading(page)).toBeVisible();
  });
});

test.describe("the email in one spelling", () => {
  test("spaces and capital letters do not matter [Пробелы и большие буквы]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");
    const typed = `  ${email.replace("anna", "Anna").replace("example.com", "Example.COM")} `;

    await requestLink(page, typed);

    await expectLinkSent(page, email);
    await waitForLetter(email);
  });

  test("two spellings are one user [Та же почта — тот же пользователь]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email.replace("anna", "Anna").toUpperCase());
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    const dialog = page.getByRole("dialog", { name: "Новый контакт" });

    await dialog.getByLabel("Имя").fill("Глеб Орлов");
    await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(dialog).toBeHidden();

    const { context, page: other } = await newBrowser(
      page.context().browser()!,
    );

    try {
      await signIn(other, email);

      await expect(
        currentPage(other).getByRole("link", { name: /Глеб Орлов/ }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("a wrong email", () => {
  test("is shown under the field and sends nothing [Ошибка в адресе]", async ({
    page,
  }) => {
    const before = await countAllLetters();

    for (const typed of ["anna@", ""]) {
      await requestLink(page, typed);

      await expect(emailField(page)).toHaveAccessibleDescription(CHECK_EMAIL);
      await expect(page.getByText("Ссылка для входа отправлена")).toHaveCount(
        0,
      );
    }

    expect(await countAllLetters()).toBe(before);
  });

  test("is refused by the server when it does not come from the form [Запрос не из формы]", async ({
    request,
    baseURL,
  }) => {
    const before = await countAllLetters();

    const response = await postLinkRequest(request, baseURL!, "anna@");

    expect(response.status()).toBe(400);
    expect(await countAllLetters()).toBe(before);
  });
});

test.describe("a link works once and 15 minutes", () => {
  test("the link of the letter signs in [Вход по ссылке]", async ({ page }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);
    await addContactFor(email, "Глеб Орлов");
    await page.reload();

    await expect(
      currentPage(page).getByRole("link", { name: /Глеб Орлов/ }),
    ).toBeVisible();
  });

  test("a used link is old [Ссылку открыли второй раз]", async ({ page }) => {
    const email = uniqueEmail("anna");
    const letter = await requestLetter(page, email);

    await page.goto(letter.link);
    await expect(contactsHeading(page)).toBeVisible();

    await page.goto(letter.link);

    await expectExpiredPage(page);
  });

  test("a link of 16 minutes ago is old [Прошло больше 15 минут]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");
    const letter = await requestLetter(page, email);

    // Sent 16 minutes ago: it ran out a minute ago.
    await withDatabase(async (sql) => {
      await sql`
        update verification
        set created_at = now() - interval '16 minutes',
          expires_at = now() - interval '1 minute'
        where value::jsonb ->> 'email' = ${email}
      `;
    });

    await page.goto(letter.link);

    await expectExpiredPage(page);
    await expect(contactsHeading(page)).toHaveCount(0);
  });

  test("a new link cancels the old one [Запросила ссылку дважды]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");
    const first = await requestLetter(page, email);
    const second = await requestLetter(page, email, 2);

    expect(second.link).not.toBe(first.link);

    await page.goto(first.link);
    await expectExpiredPage(page);

    await page.goto(second.link);
    await expect(contactsHeading(page)).toBeVisible();
  });

  test("the button of the old link page leads to the sign-in [Кнопка на страницу входа]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");
    const letter = await requestLetter(page, email);
    const changed = new URL(letter.link);

    changed.searchParams.set("token", "unknown");
    await page.goto(changed.toString());
    await expectExpiredPage(page);

    await page.getByRole("link", { name: "Запросить новую ссылку" }).click();

    await expectLoginPage(page);
  });

  test("a link with a changed key is old [Ссылка с неизвестным ключом]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");
    const letter = await requestLetter(page, email);
    const changed = new URL(letter.link);

    changed.searchParams.set(
      "token",
      `${changed.searchParams.get("token")!.slice(0, -1)}x`,
    );

    await page.goto(changed.toString());

    await expectExpiredPage(page);
    await expect(contactsHeading(page)).toHaveCount(0);
  });
});

test.describe("no more than three letters in ten minutes", () => {
  test("the fourth request is refused [Четвёртый запрос]", async ({ page }) => {
    const email = uniqueEmail("anna");

    for (let count = 1; count <= 3; count++) {
      await requestLetter(page, email, count);
    }

    await requestLink(page, email);

    await expect(page.getByText(TOO_OFTEN)).toBeVisible();
    await expect(page.getByText("Ссылка для входа отправлена")).toHaveCount(0);
    expect(await countLettersTo(email)).toBe(3);
  });

  test("ten minutes later a link can be asked for again [Через 10 минут снова можно]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    for (let count = 1; count <= 3; count++) {
      await requestLetter(page, email, count);
    }

    // The three letters went 11 minutes ago.
    await withDatabase(async (sql) => {
      await sql`
        update login_link_sends
        set created_at = created_at - interval '11 minutes'
        where email = ${email}
      `;
    });

    await requestLetter(page, email, 4);
  });

  test("another email does not wait [Другая почта не ждёт]", async ({
    page,
  }) => {
    const anna = uniqueEmail("anna");
    const boris = uniqueEmail("boris");

    for (let count = 1; count <= 3; count++) {
      await requestLetter(page, anna, count);
    }

    await requestLetter(page, boris);
  });

  test("the limit holds for a request that does not come from the form [Лимит для запроса не из формы]", async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail("anna");

    for (let count = 1; count <= 3; count++) {
      await requestLetter(page, email, count);
    }

    const response = await postLinkRequest(request, baseURL!, email);

    expect(response.status()).toBe(429);
    expect(await countLettersTo(email)).toBe(3);
  });
});

test.describe("a sign-in holds 30 days", () => {
  test("a closed browser stays signed in [Вернулась через несколько дней]", async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);

    const kept = await page.context().storageState();
    const letters = await countLettersTo(email);

    await page.context().close();

    // Five days later: 25 of the 30 days are left.
    await withDatabase(async (sql) => {
      await sql`
        update session set expires_at = now() + interval '25 days'
        where user_id = ${userIdOf(sql, email)}
      `;
    });

    const reopened = await browser.newContext({ baseURL, storageState: kept });

    try {
      const again = await reopened.newPage();

      await again.goto("/");

      await expect(contactsHeading(again)).toBeVisible();
      expect(await countLettersTo(email)).toBe(letters);
    } finally {
      await reopened.close();
    }
  });

  test("more than 30 days after the last visit the sign-in is over [Не заходила больше 30 дней]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);

    await withDatabase(async (sql) => {
      await sql`
        update session
        set expires_at = now() - interval '1 day',
          updated_at = now() - interval '31 days'
        where user_id = ${userIdOf(sql, email)}
      `;
    });

    await page.goto("/");

    await expectLoginPage(page);
  });

  test("a visit moves the end of the sign-in on [Заход продлевает вход]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);

    // Signed in 20 days ago: 10 days are left.
    await withDatabase(async (sql) => {
      await sql`
        update session
        set expires_at = now() + interval '10 days',
          updated_at = now() - interval '20 days'
        where user_id = ${userIdOf(sql, email)}
      `;
    });

    await page.goto("/");
    await expect(contactsHeading(page)).toBeVisible();

    const in29Days = Date.now() + 29 * DAY_MS;
    const [row] = await withDatabase(
      async (sql) =>
        await sql<{ expiresAt: Date }[]>`
        select expires_at as "expiresAt" from session
        where user_id = ${userIdOf(sql, email)}
      `,
    );

    expect(row.expiresAt.getTime()).toBeGreaterThan(in29Days);

    const cookie = sessionCookie(await page.context().cookies());

    expect(cookie!.expires * 1000).toBeGreaterThan(in29Days);
  });

  test("two browsers are signed in at once [Два устройства]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);
    await addContactFor(email, "Глеб Орлов");

    const { context, page: other } = await newBrowser(
      page.context().browser()!,
    );

    try {
      await signIn(other, email);

      for (const each of [page, other]) {
        await each.goto("/");
        await expect(
          currentPage(each).getByRole("link", { name: /Глеб Орлов/ }),
        ).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("the email and «Выйти» above the sheet", () => {
  test("are on every page [Почта видна на страницах]", async ({ page }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);

    const id = await addContactFor(email, "Глеб Орлов");

    for (const path of ["/", `/contacts/${id}`, "/groups"]) {
      await page.goto(path);

      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    }
  });

  test("«Выйти» leads to the sign-in page [Выйти]", async ({ page }) => {
    await signIn(page, uniqueEmail("anna"));

    await page.getByRole("button", { name: "Выйти" }).click();
    await expectLoginPage(page);

    await page.goto("/");
    await expectLoginPage(page);
  });

  test("«Выйти» keeps the other browser signed in [Другое устройство остаётся внутри]", async ({
    page,
  }) => {
    const email = uniqueEmail("anna");

    await signIn(page, email);

    const { context, page: other } = await newBrowser(
      page.context().browser()!,
    );

    try {
      await signIn(other, email);

      await page.getByRole("button", { name: "Выйти" }).click();
      await expectLoginPage(page);

      await other.reload();
      await expect(contactsHeading(other)).toBeVisible();
      await expect(other.getByText(email, { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

// openspec/specs/data-ownership: what a card address and an
// empty book look like.
test.describe("a card that is not yours", () => {
  test("a direct link to A's contact shows «Контакт не найден» to B [Прямая ссылка на чужой контакт]", async ({
    page,
  }) => {
    const ownerOfAnna = uniqueEmail("a");
    const anna = await withDatabase(async (sql) => {
      await sql`
        insert into "user" (id, name, email, email_verified)
        values (gen_random_uuid()::text, '', ${ownerOfAnna}, true)
      `;
      const [row] = await sql<{ id: number }[]>`
        insert into contacts (owner_id, name, about)
        values (${userIdOf(sql, ownerOfAnna)}, 'Анна Смирнова', 'Тренер по теннису')
        returning id
      `;

      await sql`insert into notes (contact_id, body) values (${row.id}, 'Обсудили турнир')`;

      return row.id;
    });

    await signIn(page, uniqueEmail("b"));
    await page.goto(`/contacts/${anna}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Контакт не найден" }),
    ).toBeVisible();

    for (const text of [
      "Анна Смирнова",
      "Тренер по теннису",
      "Обсудили турнир",
    ]) {
      await expect(page.getByText(text)).toHaveCount(0);
    }

    await page.getByRole("link", { name: /Ко всем контактам/ }).click();
    await expect(contactsHeading(page)).toBeVisible();
  });

  test("a card number nobody has shows the same page [Ссылка на несуществующий контакт]", async ({
    page,
  }) => {
    await signIn(page, uniqueEmail("anna"));
    await page.goto("/contacts/999999");

    await expect(
      page.getByRole("heading", { level: 1, name: "Контакт не найден" }),
    ).toBeVisible();
  });

  test("a new user starts with an empty book [Первый вход]", async ({
    page,
  }) => {
    await signIn(page, uniqueEmail("new"));

    await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
    await expect(
      page.getByText(
        "Нажмите «Добавить контакт», чтобы записать первого человека",
      ),
    ).toBeVisible();
    await expect(
      currentPage(page).getByRole("navigation", { name: "Группы контактов" }),
    ).toHaveCount(0);
    await expect(
      currentPage(page).locator(
        "section[aria-labelledby=keep-in-touch-heading]",
      ),
    ).toHaveCount(0);
    // The contacts of the e2e user are in the database, not in this book.
    await expect(page.getByText("Борис Петров")).toHaveCount(0);
  });
});
