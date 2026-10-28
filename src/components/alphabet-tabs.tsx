import { AlphabetTab, LetterFromAddress } from "@/components/alphabet-tab";
import { listLetters } from "@/db/queries";
import {
  letterAnchor,
  listHref,
  parseShown,
  shownFor,
} from "@/lib/list-filter";
import { readListFilter } from "@/lib/read-list-filter";

// Thumb-index tabs along the right edge of the list sheet, like in a paper
// address book: one per letter the list has, for the same search and group.
// A tab is a plain link to the list, long enough to hold its letter (whole
// hundreds, as «Показать ещё» makes it), with the letter's anchor; the tab
// scrolls to the letter once the list is there (alphabet-tab.tsx). `replace`
// keeps the jumps out of the history; the length stays in the address, so
// «Назад» from a card comes back to the same place.
//
// Desktop: paper tabs stick out of the sheet onto the baize. Phones: a narrow
// strip of letters inside the sheet, at its very edge.
export async function AlphabetTabs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { search, group } = await readListFilter(searchParams);
  const shown = parseShown(await searchParams);
  const letters = await listLetters(search, group?.id ?? null);

  if (letters.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-16 md:w-hero-wrap-r md:translate-x-full">
      <nav
        aria-label="Алфавит"
        style={{ "--letters": letters.length } as React.CSSProperties}
        className="alphabet-tabs pointer-events-auto sticky top-74 flex flex-col"
      >
        <LetterFromAddress />
        {letters.map(({ letter, position }) => (
          <AlphabetTab
            key={letter}
            letter={letter}
            href={`${listHref({
              q: search,
              group: group?.id ?? null,
              shown: Math.max(shown, shownFor(position)),
            })}#${encodeURIComponent(letterAnchor(letter))}`}
            className="alphabet-tab flex items-center justify-center font-sans text-date leading-none font-bold text-ink-muted transition-colors hover:text-ink-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:mr-4 md:rounded-r-md md:bg-paper-aged md:paper-sticker md:text-ink-strong md:shadow-tape md:hover:bg-paper"
          />
        ))}
      </nav>
    </div>
  );
}
