import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { db } from "@/db";
import {
  cancelOtherLoginLinks,
  releaseLoginLinkSend,
  reserveLoginLinkSend,
  storedLoginLinkId,
} from "@/db/login-links";
import * as schema from "@/db/schema";

import { buildLoginEmail } from "./login-email";
import { MailError, sendMail } from "./mail";
import { parseLoginEmail } from "./validation";

// Sign-in by a link from an email (Better Auth). The secret comes from
// BETTER_AUTH_SECRET, the address of the app — for the links in the letters —
// from BETTER_AUTH_URL.

const DAY_SECONDS = 24 * 60 * 60;

// The codes of the errors the sign-in form tells apart.
export const LOGIN_ERROR = {
  invalidEmail: "INVALID_EMAIL",
  tooManyLinks: "TOO_MANY_LINKS",
  emailNotSent: "EMAIL_NOT_SENT",
} as const;

// Every request for a sign-in link passes here before Better Auth handles it:
// the HTTP request to /api/auth/sign-in/magic-link and the call of the form's
// server action alike. So a request that does not come from the form gets the
// same checks. The email is checked and put in one spelling (Better Auth
// would refuse spaces itself and keep the capital letters), then the limit of
// 3 emails in 10 minutes takes a place for this email.
const checkLinkRequest = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/magic-link") {
    return;
  }

  const parsed = parseLoginEmail(ctx.body?.email);

  if (!parsed.ok) {
    throw new APIError("BAD_REQUEST", {
      code: LOGIN_ERROR.invalidEmail,
      message: "The email is not valid.",
    });
  }

  const sendId = await reserveLoginLinkSend(parsed.data);

  if (sendId === null) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: LOGIN_ERROR.tooManyLinks,
      message: "Too many sign-in emails to this address.",
    });
  }

  // The place taken goes along to sendMagicLink, which gives it back when
  // the email is not sent. It replaces whatever the request said there.
  return {
    context: {
      body: {
        ...ctx.body,
        email: parsed.data,
        metadata: { ...ctx.body.metadata, loginLinkSendId: sendId },
      },
    },
  };
});

function sendIdOf(metadata: unknown): number | null {
  const id =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>).loginLinkSendId
      : undefined;

  return typeof id === "number" ? id : null;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  hooks: { before: checkLinkRequest },
  verification: {
    storeIdentifier: {
      default: "plain",
      overrides: {
        "magic-link:": {
          hash: async (identifier) => storedLoginLinkId(identifier),
        },
      },
    },
  },
  // A sign-in holds 30 days after the last visit on the device. The date is
  // moved on at most once a day, so not every page writes to the database:
  // the sign-in ends 29 to 30 days after the last visit.
  session: {
    expiresIn: 30 * DAY_SECONDS,
    updateAge: DAY_SECONDS,
  },
  // Better Auth's own limit per IP address (5 link requests a minute), on in
  // production. The e2e tests come from one address and run the production
  // build, so they switch it off.
  rateLimit:
    process.env.AUTH_IP_RATE_LIMIT === "off" ? { enabled: false } : undefined,
  telemetry: { enabled: false },
  plugins: [
    magicLink({
      // A link works 15 minutes and once: Better Auth deletes it on use.
      expiresIn: 15 * 60,
      async sendMagicLink({ email, url, token, metadata }) {
        // The new link cancels the earlier ones of this email.
        await cancelOtherLoginLinks(email, token);

        try {
          await sendMail({ to: email, ...buildLoginEmail(url) });
        } catch (error) {
          const sendId = sendIdOf(metadata);

          if (sendId !== null) {
            await releaseLoginLinkSend(sendId);
          }

          if (!(error instanceof MailError)) {
            throw error;
          }

          // Only the code: never the address.
          console.error(error.message);

          throw new APIError("INTERNAL_SERVER_ERROR", {
            code: LOGIN_ERROR.emailNotSent,
            message: "The sign-in email was not sent.",
          });
        }
      },
    }),
    // Lets server actions set and remove the sign-in cookie. Must be last.
    nextCookies(),
  ],
});
