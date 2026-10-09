import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the values.",
  );
}

// Next.js reloads modules on every change in development. Keeping the client
// on globalThis prevents opening a new connection pool on each reload.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

// A short connect timeout: when the database is not running, the page shows
// its "database is not started" message quickly instead of hanging.
const client =
  globalForDb.pgClient ??
  postgres(connectionString, { max: 10, connect_timeout: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
