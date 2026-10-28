"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Label({ count }: { count: number }) {
  const { pending } = useLinkStatus();

  return pending ? "Загружаю…" : `Показать ещё ${count}`;
}

// «Показать ещё» under the contact list. It is a link to the same list, one
// hundred longer: `replace` keeps it out of the browser history and
// `scroll={false}` keeps the page in place. Once the longer list is on the
// page, the focus goes to its first new row. The component stays on the page
// when everybody is shown, so it can still move the focus after the last
// portion.
export function ShowMoreLink({
  shown,
  remaining,
  href,
}: {
  // How many contacts the address asks for; the list may hold fewer.
  shown: number;
  // How many found contacts are not shown yet.
  remaining: number;
  href: string;
}) {
  // The number of the first new row, while the longer list is on its way.
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    const from = focusFrom.current;

    if (from === null || shown <= from) {
      return;
    }

    focusFrom.current = null;
    document
      .querySelectorAll<HTMLAnchorElement>("li.contact-row > a")
      [from]?.focus({ preventScroll: true });
  }, [shown]);

  if (remaining <= 0) {
    return null;
  }

  return (
    <div className="flex h-64 items-center">
      <Link
        href={href}
        replace
        scroll={false}
        onClick={() => {
          focusFrom.current = shown;
        }}
        // cn drops the transparent border of the base classes.
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <Label count={remaining} />
      </Link>
    </div>
  );
}
