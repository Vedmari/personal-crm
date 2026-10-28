"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useBookmark, useBookmarkHere } from "@/lib/bookmark-store";
import { cn } from "@/lib/utils";

// Where the ribbon hangs over the top edge of the diary sheet.
const PLACE_CLASS_NAME =
  "absolute -top-4 right-20 z-20 h-118 w-18 md:-top-6 md:right-ribbon-r md:h-180 md:w-24";

function Ribbon() {
  return (
    <span className="block size-full bg-ink-red ribbon-shape inset-shadow-ribbon md:inset-shadow-ribbon-md" />
  );
}

// The ribbon that leads nowhere. Also the Suspense fallback of BookmarkRibbon:
// it reads the address, which Next.js renders apart from the page shell.
export function PlainRibbon() {
  return (
    <div aria-hidden="true" data-bookmark-ribbon className={PLACE_CLASS_NAME}>
      <Ribbon />
    </div>
  );
}

// The red ribbon of the diary sheet. It leads to the contact card opened last
// in this browser. Before any card is opened, on that very card, and on the
// server, it is only a ribbon.
export function BookmarkRibbon() {
  const bookmark = useBookmark();
  const pathname = usePathname();

  if (!bookmark || pathname === `/contacts/${bookmark.id}`) {
    return <PlainRibbon />;
  }

  return (
    <Link
      href={`/contacts/${bookmark.id}`}
      transitionTypes={["page-forward"]}
      aria-label={`Закладка: ${bookmark.name}`}
      title={`Закладка: ${bookmark.name}`}
      data-bookmark-ribbon
      // The ribbon is narrow: the invisible :before widens the place to press.
      // On hover it slides out a little, as if pulled.
      className={cn(
        PLACE_CLASS_NAME,
        "transition-[height] duration-150 before:absolute before:inset-y-0 before:-right-8 before:-left-8 hover:h-126 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hover:h-190",
      )}
    >
      <Ribbon />
    </Link>
  );
}

// Put on the contact card: the ribbon of the next pages leads back here.
export function BookmarkHere({ id, name }: { id: number; name: string }) {
  useBookmarkHere({ id, name });

  return null;
}
