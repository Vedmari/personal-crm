import "server-only";

import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";

// When a query fails, Drizzle throws an error that carries the query values
// (names, phones, emails, what was agreed, note texts) in its message and in
// its `params`, and the Postgres error inside may quote the whole row.
// Next.js writes a thrown error to the server log as it is, so the log would
// get personal data. Query functions throw this error instead: it tells which
// query failed and why, never with what values.
export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

// Error codes and table, column and constraint names describe a failure
// without the data: "23505 contacts contacts_email_key", "ECONNREFUSED".
function describeFailure(cause: unknown): string {
  if (cause instanceof postgres.PostgresError) {
    return [
      cause.code,
      cause.table_name,
      cause.column_name,
      cause.constraint_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (
    cause instanceof Error &&
    "code" in cause &&
    typeof cause.code === "string"
  ) {
    return cause.code;
  }

  return "unknown cause";
}

// The name is passed as text: the production build shortens function names.
export function safeQuery<Args extends unknown[], Result>(
  name: string,
  query: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    try {
      return await query(...args);
    } catch (error) {
      if (error instanceof DrizzleQueryError) {
        throw new DatabaseError(
          `${name} failed: ${describeFailure(error.cause)}`,
        );
      }

      throw error;
    }
  };
}
