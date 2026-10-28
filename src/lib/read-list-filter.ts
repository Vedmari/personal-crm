import "server-only";

import { cache } from "react";

import { findGroup, type GroupRef } from "@/db/queries";

import { parseListParams } from "./list-filter";

export type ListFilter = {
  search: string;
  // The group of the address. Null when the address has none, or has one that
  // does not exist any more: the list then shows everybody.
  group: GroupRef | null;
};

// The filter the address asks for. The filter row, the "Пора связаться" block
// and the list all read it; `cache` makes them share one lookup per request.
export const readListFilter = cache(
  async (
    searchParams: Promise<Record<string, string | string[] | undefined>>,
  ): Promise<ListFilter> => {
    const { search, groupId } = parseListParams(await searchParams);
    const group =
      groupId === null ? null : ((await findGroup(groupId)) ?? null);

    return { search, group };
  },
);
