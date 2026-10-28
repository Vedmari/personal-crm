// Runs once before the `db` tests: makes sure the test database exists and has
// the current schema, then hands its address to the test files.

import { execFileSync } from "node:child_process";

import type { TestProject } from "vitest/node";

import { assertSafeTestDatabase, toTestDatabaseUrl } from "./database";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

function loadEnvFile(): void {
  try {
    // Does not override variables that are already set (CI sets them itself).
    process.loadEnvFile(".env");
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  }
}

// Database work runs in separate Node.js processes, outside Vitest's loader
// (see test/create-database.mts). The address goes in the environment, not in
// the arguments: it holds the password.
function runScript(script: string, testUrl: string): void {
  try {
    execFileSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    const reason = stderr.trim().split("\n").slice(0, 3).join("\n");

    throw new Error(
      `Preparing the test database failed (${script}):\n${reason}`,
    );
  }
}

export default function setup(project: TestProject): void {
  // An error that carries a stack makes Vitest look up the source map of this
  // file, and that lookup fails ("TypeError: code.charCodeAt is not a
  // function"), which hides the message. Errors made here have no stack.
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 0;

  try {
    loadEnvFile();

    const workingUrl = process.env.DATABASE_URL;

    if (!workingUrl) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in the values.",
      );
    }

    const testUrl = toTestDatabaseUrl(workingUrl);

    assertSafeTestDatabase(testUrl, workingUrl);

    runScript("test/create-database.mts", testUrl);
    // The same script the deploy uses, pointed at the test database.
    runScript("scripts/migrate.mts", testUrl);

    project.provide("testDatabaseUrl", testUrl);
  } finally {
    Error.stackTraceLimit = stackTraceLimit;
  }
}
