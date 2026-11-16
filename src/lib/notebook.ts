// Rules of the notebook look: when the cover is shown, and where the
// bookmark ribbon leads.

// The cover is shown the first time the app is opened in a browser session,
// and every time somebody comes from the landing (its links carry
// ?from=landing). A session cookie remembers that the cover was opened.
//
// Self-contained on purpose: coverScript() inlines its source into the page,
// so it must not use anything from this module.
export function shouldShowCover({
  cookie,
  search,
}: {
  cookie: string;
  search: string;
}): boolean {
  const opened = cookie
    .split(";")
    .some((part) => part.trim() === "notebook-opened=1");
  const fromLanding = new URLSearchParams(search).get("from") === "landing";

  return fromLanding || !opened;
}

// The address without the landing mark, so a reload does not show the cover again.
export function withoutLandingMark(search: string): string {
  const params = new URLSearchParams(search);

  if (params.get("from") === "landing") {
    params.delete("from");
  }

  const rest = params.toString();

  return rest ? `?${rest}` : "";
}

// Runs in <head> before the first paint: closes the cover (data-cover on
// <html>) and sets the session cookie. Deciding before the paint means the
// page never flashes before the cover, and the cover never flashes when it is
// not needed. Without JavaScript there is no cover at all.
export function coverScript(): string {
  return `try{if((${shouldShowCover.toString()})({cookie:document.cookie,search:location.search})){document.documentElement.setAttribute("data-cover","closed");document.cookie="notebook-opened=1; path=/; SameSite=Lax"}}catch(e){}`;
}

export const BOOKMARK_STORAGE_KEY = "notebook-bookmark";

export type Bookmark = { id: number; name: string };

// What localStorage keeps: the card and the user who opened it.
export function writeBookmark(bookmark: Bookmark, userId: string): string {
  return JSON.stringify({ ...bookmark, userId });
}

// The last contact card opened in this browser by the signed-in user, as
// saved in localStorage. Another user's bookmark, one saved before there were
// users, and anything else (nothing saved, another app's value, a broken
// record) is no bookmark: the ribbon must not lead to somebody else's card or
// name somebody else's contact.
export function readBookmark(
  raw: string | null,
  userId: string | null,
): Bookmark | null {
  if (!raw || userId === null) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== "object" || value === null) {
      return null;
    }

    const { id, name, userId: owner } = value as Record<string, unknown>;

    if (
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id < 1 ||
      typeof name !== "string" ||
      name === "" ||
      owner !== userId
    ) {
      return null;
    }

    return { id, name };
  } catch {
    return null;
  }
}
