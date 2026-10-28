import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      "server-only": fromRoot("./test/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        // Pure functions: no database, a fraction of a second.
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "**/node_modules/**"],
        },
      },
      {
        // Queries and server actions against a real PostgreSQL test database
        // (see test/database.ts). One file at a time: they share the database.
        extends: true,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["test/global-setup.ts"],
          setupFiles: ["test/setup-db.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
