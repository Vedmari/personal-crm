// Runs once before the browser tests: makes sure the e2e database exists and
// has the current schema. Each test then empties it (resetDatabase).

import { execFileSync } from "node:child_process";

import { e2eDatabaseUrl, resetDatabase } from "./database";

// The address goes in the environment, not in the arguments: it holds the
// password.
function runScript(script: string, url: string): void {
  try {
    execFileSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    const reason = stderr.trim().split("\n").slice(0, 3).join("\n");

    throw new Error(
      `Preparing the e2e database failed (${script}):\n${reason}`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const url = e2eDatabaseUrl();

  runScript("test/create-database.mts", url);
  // The same script the deploy uses, pointed at the e2e database.
  runScript("scripts/migrate.mts", url);

  // Checks the database before any test runs, so a wrong address stops here.
  await resetDatabase();
}
