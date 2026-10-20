import { sql } from "drizzle-orm";

import { db } from "@/db";

// Smoke check for deployments (deploy/deploy.sh): 200 when the app is up and
// can reach the database, 503 when the database does not answer.
// The database query keeps this handler out of build-time prerendering,
// so every request checks the live state.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "database unavailable" }, { status: 503 });
  }
}
