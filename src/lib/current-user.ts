import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./auth";

// Who is signed in, read from the sign-in cookie of the request.
//
// src/proxy.ts already sends a visitor without a sign-in to /login, but every
// page component that reads data and every server action checks again with
// requireUserId: a server action is a POST that can come from anywhere, and
// Next.js asks to check the sign-in in the action itself. The id goes to
// every query as its first argument (src/db/queries.ts).

export type CurrentUser = { id: string; email: string };

// One lookup per request, however many components ask.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  return session ? { id: session.user.id, email: session.user.email } : null;
});

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user.id;
}
