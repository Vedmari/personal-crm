// Before the tests of the "app" project: the e2e user signs in through the
// form and the letter in Mailpit, and the sign-in is kept in AUTH_FILE for
// them («перед сценарием автотест входит под пользователем»).

import { test as setup } from "@playwright/test";

import { AUTH_FILE, E2E_USER_EMAIL, signIn } from "./auth";

setup("sign in the e2e user", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.context().storageState({ path: AUTH_FILE });
});
