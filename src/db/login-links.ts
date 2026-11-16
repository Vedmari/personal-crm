import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";

import { safeQuery } from "./errors";
import { db } from "./index";
import { loginLinkSends, verification } from "./schema";

// The limit of sign-in emails: no more than 3 to one email in 10 minutes.
// Better Auth counts its own limit per IP address and only for requests from
// outside, so the limit per email is kept here and checked in the before-hook
// of the link request (src/lib/auth.ts) for every request alike.

const LINKS_PER_WINDOW = 3;
const WINDOW = sql`interval '10 minutes'`;

// Takes a place for one more email to `email`. Returns its id, or null when
// three emails went there in the last 10 minutes. The lock on the email makes
// two requests at once wait for each other, so they cannot both take the
// third place.
export const reserveLoginLinkSend = safeQuery(
  "reserveLoginLinkSend",
  async (email: string): Promise<number | null> => {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

      const windowStart = sql`now() - ${WINDOW}`;

      // Old rows are never counted again; nobody needs them.
      await tx
        .delete(loginLinkSends)
        .where(lt(loginLinkSends.createdAt, windowStart));

      const recent = await tx
        .select({ id: loginLinkSends.id })
        .from(loginLinkSends)
        .where(
          and(
            eq(loginLinkSends.email, email),
            gte(loginLinkSends.createdAt, windowStart),
          ),
        );

      if (recent.length >= LINKS_PER_WINDOW) {
        return null;
      }

      const [row] = await tx
        .insert(loginLinkSends)
        .values({ email })
        .returning({ id: loginLinkSends.id });

      return row.id;
    });
  },
);

// The email was not sent: the limit counts sent emails, not attempts.
export const releaseLoginLinkSend = safeQuery(
  "releaseLoginLinkSend",
  async (id: number): Promise<void> => {
    await db.delete(loginLinkSends).where(eq(loginLinkSends.id, id));
  },
);

// A new link cancels the earlier links of the same email. Better Auth 1.7
// keeps a link as identifier "magic-link:<key>" with the email in the JSON of
// `value` (checked in its source; the e2e test «Запросила ссылку дважды»
// fails if a later version keeps it otherwise).
export const cancelOtherLoginLinks = safeQuery(
  "cancelOtherLoginLinks",
  async (email: string, keepToken: string): Promise<void> => {
    await db
      .delete(verification)
      .where(
        and(
          sql`${verification.identifier} like 'magic-link:%'`,
          sql`${verification.identifier} <> ${`magic-link:${keepToken}`}`,
          sql`${verification.value}::jsonb ->> 'email' = ${email}`,
        ),
      );
  },
);
