import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so .env has to be loaded explicitly.
process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the values.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
