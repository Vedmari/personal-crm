// openspec/specs/user-auth, «Письмо не ушло»: the mail service
// does not take the letter. SMTP_URL points at a port nobody listens on, so
// the failure is a real one, not a stand-in.

import { expect, it, vi } from "vitest";

import { db } from "@/db";
import { loginLinkSends, verification } from "@/db/schema";

import { formOf } from "../../test/factories";

vi.hoisted(() => {
  process.env.SMTP_URL = "smtp://127.0.0.1:9";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET =
    "test-secret-of-the-database-tests-0123456789";
});

// The action passes the headers of the request to Better Auth. A test has no
// request: empty headers stand for it.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "192.0.2.1" }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

const { requestLoginLinkAction } = await import("@/app/auth-actions");
const { auth } = await import("@/lib/auth");

it("honors an unexpired link issued before hashed storage was enabled", async () => {
  const token = "legacy-test-token";
  await db.insert(verification).values({
    id: "old-link",
    identifier: `magic-link:${token}`,
    value: JSON.stringify({ type: "magic-link", email: "legacy@example.com" }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const response = await auth.handler(
    new Request(
      `http://localhost:3000/api/auth/magic-link/verify?token=${token}&callbackURL=%2F`,
    ),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("set-cookie")).toContain("session_token=");
  expect(await db.select().from(verification)).toEqual([]);
});

it("shares the IP limit between the public API and the login form", async () => {
  const ctx = await auth.$context;
  const previous = ctx.rateLimit.enabled;
  ctx.rateLimit.enabled = true;
  try {
    // Invalid requests use the IP budget before validation, without sending mail.
    for (let i = 0; i < 5; i++) {
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "192.0.2.1",
          },
          body: "{}",
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(
      await requestLoginLinkAction(formOf({ email: "test@example.com" })),
    ).toEqual({
      ok: false,
      errors: {},
      message: "Слишком часто, попробуйте через несколько минут",
    });
  } finally {
    ctx.rateLimit.enabled = previous;
  }
});

it("says the email was not sent and keeps no record of it [Письмо не ушло]", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await requestLoginLinkAction(
    formOf({ email: "anna@example.com" }),
  );

  expect(result).toEqual({
    ok: false,
    errors: {},
    message: "Не получилось отправить письмо. Попробуйте ещё раз через минуту.",
  });
  expect(await db.select().from(loginLinkSends)).toEqual([]);

  // The log tells why, never to whom.
  const logged = error.mock.calls.flat().map(String).join("\n");

  expect(logged).toContain("sendMail failed");
  expect(logged).not.toContain("anna@example.com");

  error.mockRestore();
}, 30_000);
