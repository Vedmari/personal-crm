import { Suspense } from "react";

import { AddContactButton } from "@/components/add-contact-button";
import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import { SearchBox, SearchBoxFallback } from "@/components/search-box";

export default function HomePage(props: PageProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
      {/* The header height (h-34) is what the sticky letters in the list sit under. */}
      <header className="sticky top-0 z-10 flex h-34 flex-col justify-end gap-4 bg-background pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
          <AddContactButton />
        </div>
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox />
        </Suspense>
      </header>
      <main>
        <Suspense fallback={<ContactListSkeleton />}>
          <ContactList searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
