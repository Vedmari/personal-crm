"use server";

// Sign-in and sign-out. Apart from src/app/actions.ts: everything there works
// for the signed-in user and starts with requireUserId, and these two are
// what a user who is not signed in yet (or is leaving) can do.

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, LOGIN_ERROR } from "@/lib/auth";
import { parseLoginEmail } from "@/lib/validation";

import type { ActionResult } from "./actions";

const TOO_MANY_LINKS = "Слишком часто, попробуйте через несколько минут";

const EMAIL_NOT_SENT =
  "Не получилось отправить письмо. Попробуйте ещё раз через минуту.";

// «Получить ссылку». The answer is the same for an email somebody has signed
// in with and for a new one: Better Auth makes the user only when the link is
// opened. On success the form says where the link went, in one spelling.
export async function requestLoginLinkAction(
  formData: FormData,
): Promise<ActionResult<"email", { email: string }>> {
  const parsed = parseLoginEmail(formData.get("email"));

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  try {
    await auth.api.signInMagicLink({
      body: {
        email: parsed.data,
        // After the sign-in the list opens: the letter is often opened on
        // another device, where there is no page to go back to.
        callbackURL: "/",
        errorCallbackURL: "/login/expired",
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = isAPIError(error) ? error.body?.code : undefined;

    if (code === LOGIN_ERROR.invalidEmail) {
      return { ok: false, errors: { email: "Проверьте адрес почты" } };
    }

    if (code === LOGIN_ERROR.tooManyLinks) {
      return { ok: false, errors: {}, message: TOO_MANY_LINKS };
    }

    if (code === LOGIN_ERROR.emailNotSent) {
      return { ok: false, errors: {}, message: EMAIL_NOT_SENT };
    }

    throw error;
  }

  return { ok: true, data: { email: parsed.data } };
}

// «Выйти»: ends the sign-in on this device only. Other devices stay inside.
export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });

  redirect("/login");
}
