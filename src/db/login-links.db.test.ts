// openspec/specs/user-auth: the limit of sign-in emails and the
// new link that cancels the old ones. The request for a link checks them in
// the before-hook of Better Auth (src/lib/auth.ts), for the form and for any
// other request alike; here they run against the real test database.

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cancelOtherLoginLinks,
  releaseLoginLinkSend,
  reserveLoginLinkSend,
  storedLoginLinkId,
} from "@/db/login-links";
import { loginLinkSends, verification } from "@/db/schema";

const ANNA = "anna@example.com";
const BORIS = "boris@example.com";

// An email that was sent `minutes` minutes ago.
async function sentMinutesAgo(email: string, minutes: number): Promise<void> {
  await db.insert(loginLinkSends).values({
    email,
    createdAt: new Date(Date.now() - minutes * 60_000),
  });
}

async function countSends(email: string): Promise<number> {
  const rows = await db
    .select({ id: loginLinkSends.id })
    .from(loginLinkSends)
    .where(eq(loginLinkSends.email, email));

  return rows.length;
}

describe("reserveLoginLinkSend", () => {
  it("lets three emails in ten minutes through and stops the fourth [Четвёртый запрос]", async () => {
    for (let index = 0; index < 3; index++) {
      expect(await reserveLoginLinkSend(ANNA)).toEqual(expect.any(Number));
    }

    expect(await reserveLoginLinkSend(ANNA)).toBeNull();
    expect(await countSends(ANNA)).toBe(3);
  });

  it("stops the fourth even when the requests come at once [Лимит для запроса не из формы]", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserveLoginLinkSend(ANNA)),
    );

    expect(results.filter((id) => id !== null)).toHaveLength(3);
    expect(await countSends(ANNA)).toBe(3);
  });

  it("does not count emails older than ten minutes [Через 10 минут снова можно]", async () => {
    await sentMinutesAgo(ANNA, 11);
    await sentMinutesAgo(ANNA, 10.5);
    await sentMinutesAgo(ANNA, 3);
    await sentMinutesAgo(ANNA, 2);

    expect(await reserveLoginLinkSend(ANNA)).toEqual(expect.any(Number));
    expect(await reserveLoginLinkSend(ANNA)).toBeNull();
  });

  it("keeps counting emails of the last ten minutes [Четвёртый запрос]", async () => {
    await sentMinutesAgo(ANNA, 9);
    await sentMinutesAgo(ANNA, 5);
    await sentMinutesAgo(ANNA, 1);

    expect(await reserveLoginLinkSend(ANNA)).toBeNull();
  });

  it("does not hold back another email [Другая почта не ждёт]", async () => {
    for (let index = 0; index < 3; index++) {
      await reserveLoginLinkSend(ANNA);
    }

    expect(await reserveLoginLinkSend(BORIS)).toEqual(expect.any(Number));
  });
});

describe("releaseLoginLinkSend", () => {
  it("gives the place back when the email was not sent [Письмо не ушло]", async () => {
    await reserveLoginLinkSend(ANNA);
    await reserveLoginLinkSend(ANNA);
    const third = await reserveLoginLinkSend(ANNA);

    await releaseLoginLinkSend(third!);

    expect(await countSends(ANNA)).toBe(2);
    expect(await reserveLoginLinkSend(ANNA)).toEqual(expect.any(Number));
  });
});

describe("cancelOtherLoginLinks", () => {
  // A link the way Better Auth 1.7 keeps it: the key in the identifier,
  // the email in the JSON of the value.
  async function addLink(
    token: string,
    email: string,
    legacy = false,
  ): Promise<void> {
    await db.insert(verification).values({
      id: `id-${token}`,
      identifier: legacy
        ? `magic-link:${token}`
        : storedLoginLinkId(`magic-link:${token}`),
      value: JSON.stringify({ type: "magic-link", email }),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
  }

  async function linkTokens(): Promise<string[]> {
    const rows = await db
      .select({ identifier: verification.identifier })
      .from(verification);

    return rows.map((row) => row.identifier).sort();
  }

  it("cancels the earlier links of the email and keeps the new one [Запросила ссылку дважды]", async () => {
    await addLink("first", ANNA, true);
    await addLink("second", ANNA);
    await addLink("new", ANNA);

    await cancelOtherLoginLinks(ANNA, "new");

    expect(await linkTokens()).toEqual([storedLoginLinkId("magic-link:new")]);
  });

  it("keeps the links of other emails and other kinds of rows", async () => {
    await addLink("anna-old", ANNA);
    await addLink("boris", BORIS);
    await db.insert(verification).values({
      id: "other-kind",
      identifier: "email-verification:anna",
      value: JSON.stringify({ email: ANNA }),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await cancelOtherLoginLinks(ANNA, "anna-new");

    expect(await linkTokens()).toEqual([
      "email-verification:anna",
      storedLoginLinkId("magic-link:boris"),
    ]);
  });
});
