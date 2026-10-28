import { parseId } from "./validation";

export type ListParams = {
  // What is typed in the search box.
  q?: string;
  // The chosen group; null or missing means "Все".
  group?: number | null;
};

// The address of the contact list. The search and the group live in it, so a
// link shows the same list. Every link to the list is made here, so choosing a
// group keeps the search and typing keeps the group.
export function listHref({ q, group }: ListParams): string {
  const parts: string[] = [];
  const search = q?.trim();

  if (search) {
    parts.push(`q=${encodeURIComponent(search)}`);
  }

  if (group != null) {
    parts.push(`group=${group}`);
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

// The "Пора связаться" block belongs to the plain list: it goes away while
// something is typed in the search and while a group is chosen.
export function showsKeepInTouch(filter: {
  search: string;
  group: unknown | null;
}): boolean {
  return filter.search === "" && filter.group === null;
}
