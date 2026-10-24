import { Suspense } from "react";

import { AddContactButton } from "@/components/add-contact-button";
import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import { KeepInTouchBlock } from "@/components/keep-in-touch-block";
import { Cover, DIARY_SHEET_X, DiarySheet, Logo } from "@/components/paper";
import { SearchBox, SearchBoxFallback } from "@/components/search-box";
import { cn } from "@/lib/utils";

// Everything on the sheet sits on its 32px rules: a text line starts 10px
// below a rule boundary, and every block takes a whole number of rules.
export default function HomePage(props: PageProps<"/">) {
  return (
    <Cover>
      <DiarySheet>
        <div className={cn(DIARY_SHEET_X, "pt-42 pb-22")}>
          <Logo />
          <div className="mt-row flex max-w-960 items-start justify-between gap-16">
            <h1 className="relative -top-7 font-serif text-h2 font-medium text-ink md:-top-9 md:text-h2-md">
              Контакты
            </h1>
            {/* Centred on the letters of the heading. The negative margins keep
                the row as tall as the heading, so the rules below stay in place. */}
            <div className="-mt-16 -mb-4 md:-mt-3 md:mb-0">
              <AddContactButton />
            </div>
          </div>
        </div>
        {/* Two rules tall. Its height (h-64) is what the sticky letters
            of the list and src/lib/reveal-contact.ts count from. */}
        <header className={cn(DIARY_SHEET_X, "sticky top-0 z-10 bg-paper paper-diary")}>
          <div className="flex h-64 max-w-960 items-center">
            <div className="min-w-0 flex-1">
              <Suspense fallback={<SearchBoxFallback />}>
                <SearchBox />
              </Suspense>
            </div>
          </div>
        </header>
        <main className={cn(DIARY_SHEET_X, "pt-10 pb-38")}>
          <div className="max-w-960">
            {/* Below the search bar, not above it: the block goes away when
                a search starts, and the search bar must not jump up. */}
            <Suspense fallback={null}>
              <KeepInTouchBlock searchParams={props.searchParams} />
            </Suspense>
            <Suspense fallback={<ContactListSkeleton />}>
              <ContactList searchParams={props.searchParams} />
            </Suspense>
          </div>
        </main>
      </DiarySheet>
    </Cover>
  );
}
