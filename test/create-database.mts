// Creates the test database if it does not exist yet. Run by
// test/global-setup.ts as a separate Node.js process: a failed query in
// postgres.js breaks inside Vitest's own loader, and here it can be reported.
//
// DATABASE_URL is the address of the test database (it ends with _test). The
// database is created from the maintenance database "postgres", so the working
// database is not connected to at all.
// Exit code: 0 ready, 1 refused, 2 PostgreSQL not reachable, 3 other failure.

import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const target = new URL(url);
const name = decodeURIComponent(target.pathname.replace(/^\//, ""));

// A database name cannot be a query parameter, so it is checked to hold only
// letters, digits and underscores before it is put into the statement.
if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
  console.error(`Refusing to create "${name}": not a plain *_test database name.`);
  process.exit(1);
}

target.pathname = "/postgres";

const admin = postgres(target.toString(), {
  max: 1,
  connect_timeout: 5,
  onnotice: () => {},
});

try {
  const existing = await admin`select 1 from pg_database where datname = ${name}`;

  if (existing.length === 0) {
    await admin.unsafe(`create database "${name}"`);
    console.log(`Created database ${name}.`);
  }
} catch (error) {
  if (error instanceof postgres.PostgresError) {
    console.error(`Could not create "${name}": ${error.code} ${error.message}`);
    process.exitCode = 3;
  } else {
    console.error(
      "PostgreSQL is not reachable. Start Podman: `podman machine start`, then `podman compose up -d`.",
    );
    process.exitCode = 2;
  }
} finally {
  await admin.end();
}
