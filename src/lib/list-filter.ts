import { parseId } from "./validation";

// The list opens with this many contacts, and «Показать ещё» adds as many.
export const LIST_PAGE_SIZE = 100;

export type ListParams = {
  // What is typed in the search box.
  q?: string;
  // The chosen group; null or missing means "Все".
  group?: number | null;
  // How many contacts are shown. Links that change the search or the group
  // leave it out, so a new search starts from the first hundred again.
  shown?: number;
};

// The address of the contact list. The search and the group live in it, so a
// link shows the same list. Every link to the list is made here, so choosing a
// group keeps the search and typing keeps the group.
export function listHref({ q, group, shown }: ListParams): string {
  const parts: string[] = [];
  const search = q?.trim();

  if (search) {
    parts.push(`q=${encodeURIComponent(search)}`);
  }

  if (group != null) {
    parts.push(`group=${group}`);
  }

  if (shown !== undefined && shown > LIST_PAGE_SIZE) {
    parts.push(`shown=${shown}`);
  }

  return parts.length > 0 ? `/?${parts.join("&")}` : "/";
}

type SearchParams = Record<string, string | string[] | undefined>;

// What the address says. A parameter that is missing, given twice or not an id
// counts as not given. Whether the group still exists is for the database.
export function parseListParams(searchParams: SearchParams): {
  search: string;
  groupId: number | null;
} {
  const { q, group } = searchParams;

  return {
    search: typeof q === "string" ? q.trim() : "",
    groupId: typeof group === "string" ? parseId(group) : null,
  };
}

// How many contacts the address asks to show: whole hundreds, at least one.
// Anything that is not a plain number counts as not given.
export function parseShown(searchParams: SearchParams): number {
  const { shown } = searchParams;

  if (typeof shown !== "string" || !/^\d{1,9}$/.test(shown)) {
    return LIST_PAGE_SIZE;
  }

  return Math.max(
    LIST_PAGE_SIZE,
    Math.ceil(Number(shown) / LIST_PAGE_SIZE) * LIST_PAGE_SIZE,
  );
}

// The id of a letter section of the list: alphabet tabs link to it
// (`#letter-Я`), the list puts it on the section.
export function letterAnchor(letter: string): string {
  return `letter-${letter}`;
}

// The length of the list that reaches the contact at this place
// in the alphabet (the first one is 1).
export function shownFor(position: number): number {
  return Math.max(1, Math.ceil(position / LIST_PAGE_SIZE)) * LIST_PAGE_SIZE;
}

// The "Пора связаться" block belongs to the plain list: it goes away while
// something is typed in the search and while a group is chosen.
export function showsKeepInTouch(filter: {
  search: string;
  group: unknown | null;
}): boolean {
  return filter.search === "" && filter.group === null;
}
