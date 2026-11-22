import Link from "next/link";
import { listUpcomingBirthdays } from "@/db/queries";
import { requireUserId } from "@/lib/current-user";
import { formatBirthday } from "@/lib/format";
import { showsKeepInTouch } from "@/lib/list-filter";
import { readListFilter } from "@/lib/read-list-filter";

export async function BirthdaysBlock({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  if (!showsKeepInTouch(await readListFilter(searchParams))) return null;
  const birthdays = await listUpcomingBirthdays(await requireUserId());
  if (birthdays.length === 0) return null;
  return (
    <section aria-labelledby="birthdays-heading" className="mb-row">
      <h2
        id="birthdays-heading"
        className="font-serif text-feature font-medium text-ink md:text-feature-md"
      >
        Скоро день рождения
      </h2>
      <ul>
        {birthdays.map(({ id, name, day }) => (
          <li key={id}>
            <Link
              href={`/contacts/${id}`}
              transitionTypes={["page-forward"]}
              className="flex min-h-row items-baseline justify-between gap-16 rounded-sm px-8 hover:bg-ink-strong/5 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 break-words font-serif text-body font-bold text-ink-strong">
                {name}
              </span>
              <time
                dateTime={day}
                className="shrink-0 font-sans text-body text-ink-body"
              >
                {formatBirthday(Number(day.slice(8)), Number(day.slice(5, 7)))}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
