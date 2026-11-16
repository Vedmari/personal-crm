// Signing in the way a person does: the form of /login, the letter in Mailpit,
// the link of the letter.

import { randomBytes } from "node:crypto";

import { expect, type Browser, type Page } from "@playwright/test";

import { clearLettersTo, waitForLetter } from "./mailpit";

// The user of the tests in the "app" project. The "setup" project signs them
// in once (e2e/auth.setup.ts) and keeps the sign-in in AUTH_FILE; resetDatabase
// puts the starting contacts in their book.
export const E2E_USER_EMAIL = "e2e-user@example.com";

export const AUTH_FILE = "e2e/.auth/user.json";

// Where `pnpm test:e2e` starts the app. Not 3000: the app may already be
// running there in `pnpm dev`.
export const E2E_PORT = 3200;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

// A browser where the notebook cover was opened already in this session, so it
// does not cover the first page. e2e/notebook.spec.ts clears it to test the
// cover.
export const COVER_OPENED = {
  cookies: [
    {
      name: "notebook-opened",
      value: "1",
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

// Every run gets emails of its own, so the letters and the limit of 3 emails
// in 10 minutes of an earlier run are not in the way.
const RUN = randomBytes(3).toString("hex");
let counter = 0;

export function uniqueEmail(name: string): string {
  counter += 1;
  return `${name}-${RUN}-${counter}@example.com`;
}

export function emailField(page: Page) {
  return page.getByLabel("Почта");
}

export function getLinkButton(page: Page) {
  return page.getByRole("button", { name: "Получить ссылку" });
}

// Fills in the form of /login and presses «Получить ссылку».
export async function requestLink(page: Page, typed: string): Promise<void> {
  await page.goto("/login");
  await emailField(page).fill(typed);
  await getLinkButton(page).click();
}

export async function expectLinkSent(page: Page, email: string) {
  await expect(
    page.getByText(`Ссылка для входа отправлена на ${email}`),
  ).toBeVisible();
}

// Asks for a link and opens it from the letter: the page shows the contacts.
export async function signIn(page: Page, email: string): Promise<void> {
  await clearLettersTo(email);
  await requestLink(page, email);
  await expectLinkSent(page, email);

  const letter = await waitForLetter(email);

  await page.goto(letter.link);
  await expect(
    page.getByRole("heading", { level: 1, name: "Контакты" }),
  ).toBeVisible();
}

// Another browser: no cookies or storage of the test's own one. The cover is
// opened already, as in the page of the test.
export async function newBrowser(browser: Browser) {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState: COVER_OPENED,
  });

  return { context, page: await context.newPage() };
}
