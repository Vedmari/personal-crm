import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

// Without a sign-in only /login and /login/expired open; every other page
// leads to /login. A signed-in user on /login goes to the list.
//
// It is also where a sign-in is moved on: Better Auth extends the session of
// a visit at most once a day and sends the new cookie with its answer, which
// goes out with the page. A Server Component cannot set a cookie, so this is
// the one place that can.
//
// Not the only check: the components that read data and every server action
// call requireUserId (src/lib/current-user.ts) themselves.

const LOGIN = "/login";
// Shown with and without a sign-in: a used link may be opened again in the
// browser that is signed in with it.
const EXPIRED = "/login/expired";

function withCookies(response: NextResponse, from: Headers | null) {
  for (const cookie of from?.getSetCookie() ?? []) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { headers, response: session } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  if (!session) {
    if (pathname === LOGIN || pathname === EXPIRED) {
      return withCookies(NextResponse.next(), headers);
    }

    return withCookies(
      NextResponse.redirect(new URL(LOGIN, request.url)),
      headers,
    );
  }

  if (pathname === LOGIN) {
    return withCookies(
      NextResponse.redirect(new URL("/", request.url)),
      headers,
    );
  }

  return withCookies(NextResponse.next(), headers);
}

export const config = {
  matcher: [
    // Everything but Better Auth's own addresses (the link of a letter among
    // them), the check of the server, the files of Next.js and the files of
    // public/ and src/app (anything with an extension: icon.svg, paper-noise.svg).
    "/((?!api/auth|health|_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)",
  ],
};
