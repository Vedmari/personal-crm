// Applies pending database migrations from ./drizzle and exits.
//
// On the server the deploy runs it as a one-off container from the new image,
// before the app starts (deploy/deploy.sh). A non-zero exit stops the deploy,
// so the app keeps running on the previous image.
// Locally use `pnpm db:migrate` (drizzle-kit); both keep track of applied
// migrations in the same table, drizzle.__drizzle_migrations.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

async function countAppliedMigrations(): Promise<number> {
  const [table] =
    await client`select to_regclass('drizzle.__drizzle_migrations') as name`;

  if (table.name === null) {
    return 0;
  }

  const [row] =
    await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
  return row.count;
}

try {
  const before = await countAppliedMigrations();
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  const after = await countAppliedMigrations();

  console.log(
    `Migrations: ${after - before} applied now, ${after} applied in total.`,
  );
} finally {
  await client.end();
}
