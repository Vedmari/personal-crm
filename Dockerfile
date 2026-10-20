# Production image of the app. Built by GitHub Actions (.github/workflows/deploy.yml)
# and pushed to GHCR; the server only pulls and runs it.
# The same image runs the app (default command) and the one-off migration step
# (`node scripts/migrate.mts`, see deploy/compose.yaml).

# Node.js 24 is the version used for local development (README.md).
FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# pnpm version comes from "packageManager" in package.json.
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The database is not reachable during the build. Pages read it only at request
# time, but src/db/index.ts requires the variable to be set when it is imported.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build \
    && rm -rf .next/cache

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY public ./public
COPY package.json next.config.ts ./
# Migrations and the test data generator run from this image as one-off containers.
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src/db/schema.ts ./src/db/schema.ts
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
