// openspec/changes/login/specs/user-auth, «Письмо не ушло»: the mail service
// does not take the letter. SMTP_URL points at a port nobody listens on, so
// the failure is a real one, not a stand-in.

import { expect, it, vi } from "vitest";

import { db } from "@/db";
import { loginLinkSends } from "@/db/schema";

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
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

const { requestLoginLinkAction } = await import("@/app/auth-actions");

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
