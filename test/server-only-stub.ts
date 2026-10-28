// Next.js makes the real "server-only" package throw when it is imported
// outside a server build. Under Vitest the server code has to be importable,
// so vitest.config.ts points that import here.
export {};
