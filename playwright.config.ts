// Browser tests (e2e/): Playwright opens the real app in Chrome, the app talks
// to a real PostgreSQL and sends its letters to Mailpit. `pnpm test:e2e`
// builds the app, starts it on its own port with the e2e database
// (e2e/database.ts) and stops it afterwards.
//
// Three projects:
// - "setup" signs the e2e user in through the form and Mailpit and keeps the
//   sign-in (e2e/auth.setup.ts);
// - "app" — the tests of the app, signed in as the e2e user;
// - "login" — the sign-in itself and two users side by side: no kept sign-in,
//   every test signs in with emails of its own.

import { defineConfig } from "@playwright/test";

import { AUTH_FILE, COVER_OPENED, E2E_BASE_URL, E2E_PORT } from "./e2e/auth";
import { e2eDatabaseUrl } from "./e2e/database";

const PORT = E2E_PORT;
const BASE_URL = E2E_BASE_URL;

const LOGIN_TESTS = [/login\.spec\.ts/, /two-users\.spec\.ts/];

export default defineConfig({
  testDir: "e2e",
  // The tests share one database, so they run one at a time.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    // The Google Chrome installed on the computer: Playwright does not
    // download a browser of its own.
    channel: "chrome",
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The notebook cover does not cover the first page of every test.
    storageState: COVER_OPENED,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "app",
      testIgnore: [/auth\.setup\.ts/, ...LOGIN_TESTS],
      dependencies: ["setup"],
      use: { storageState: AUTH_FILE },
    },
    { name: "login", testMatch: LOGIN_TESTS },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    // A static file: the server starts before globalSetup prepares the
    // database, so a page that reads the database could fail here.
    url: `${BASE_URL}/icon.svg`,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      NEXT_TELEMETRY_DISABLED: "1",
      // The links in the letters lead to this server.
      BETTER_AUTH_URL: BASE_URL,
      // .env of this computer or the CI job; a stand-in works as well: the
      // sign-ins of the tests live only in the e2e database.
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ||
        "e2e-only-secret-of-the-browser-tests-0123456789",
      // The tests read the letters from Mailpit.
      SMTP_URL: process.env.SMTP_URL || "smtp://localhost:1025",
      // All tests come from one address, and `pnpm start` runs the production
      // build, where Better Auth limits link requests per address.
      AUTH_IP_RATE_LIMIT: "off",
    },
  },
});
