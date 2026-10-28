// Browser tests (e2e/): Playwright opens the real app in Chrome, the app talks
// to a real PostgreSQL. `pnpm test:e2e` builds the app, starts it on its own
// port with the e2e database (e2e/database.ts) and stops it afterwards.

import { defineConfig } from "@playwright/test";

import { e2eDatabaseUrl } from "./e2e/database";

// Not 3000: the app may already be running there in `pnpm dev`.
const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;

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
    // The notebook cover was opened already in this browser session, so it
    // does not cover the first page of every test. e2e/notebook.spec.ts
    // clears it to test the cover.
    storageState: {
      cookies: [
        {
          name: "notebook-opened",
          value: "1",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
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
    },
  },
});
