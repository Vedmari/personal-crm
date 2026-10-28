import Link from "next/link";

import { listGroups } from "@/db/queries";
import { formatCount } from "@/lib/format";
import { listHref } from "@/lib/list-filter";
import { readListFilter } from "@/lib/read-list-filter";
import { cn } from "@/lib/utils";

// Each chip sits in a row one rule (32px) tall, so a row that wraps to a
// second line still stands on the rules of the sheet.
const CHIP_CLASS_NAME =
  "my-1 inline-flex h-30 items-center gap-6 rounded-pill border px-12 font-sans text-body leading-none font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-body-md";

const CHIP_IDLE_CLASS_NAME =
  "border-paper-edge-deep bg-paper-grid text-ink-strong hover:border-ink-muted";

const CHIP_CHOSEN_CLASS_NAME = "border-ink-strong bg-ink-strong text-btn-text";

// The row under the search bar: "Все" and the groups with their sizes. A chip
// is a link, so the chosen group lives in the address, and choosing one keeps
// the search that is typed.
export async function GroupFilter({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ search, group: chosen }, groups] = await Promise.all([
    readListFilter(searchParams),
    listGroups(),
  ]);

  const manageLink = (
    <Link
      href="/groups"
      className="inline-flex h-32 items-center rounded-sm font-sans text-body font-medium whitespace-nowrap text-ink-strong underline decoration-ink-muted/50 underline-offset-4 hover:decoration-book-cover focus-visible:outline-2 focus-visible:outline-ring md:text-body-md"
    >
      Группы →
    </Link>
  );

  if (groups.length === 0) {
    return <div className="mb-row">{manageLink}</div>;
  }

  return (
    <nav
      aria-label="Группы контактов"
      className="mb-row flex flex-wrap items-center gap-x-8"
    >
      <Link
        href={listHref({ q: search })}
        aria-current={chosen === null ? "page" : undefined}
        className={cn(
          CHIP_CLASS_NAME,
          chosen === null ? CHIP_CHOSEN_CLASS_NAME : CHIP_IDLE_CLASS_NAME,
        )}
      >
        Все
      </Link>
      {groups.map((group) => {
        const isChosen = chosen?.id === group.id;

        return (
          <Link
            key={group.id}
            href={listHref({ q: search, group: group.id })}
            aria-current={isChosen ? "page" : undefined}
            className={cn(
              CHIP_CLASS_NAME,
              isChosen ? CHIP_CHOSEN_CLASS_NAME : CHIP_IDLE_CLASS_NAME,
            )}
          >
            <span className="max-w-[20ch] truncate">{group.name}</span>
            <span
              className={cn(
                "font-normal lining-nums tabular-nums",
                isChosen ? "text-btn-text/70" : "text-ink-muted",
              )}
            >
              {formatCount(group.contactCount)}
            </span>
          </Link>
        );
      })}
      {manageLink}
    </nav>
  );
}
