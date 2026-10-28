"use client";

import Link from "next/link";
import { useEffect } from "react";

import { revealLetter } from "@/lib/reveal-contact";

// One alphabet tab: a link to the list long enough to hold the letter, with
// the letter's anchor. The scroll is ours, not the router's: the section of a
// far letter appears only once the longer list arrives, so revealLetter waits
// for it. Without JavaScript the anchor still takes the browser there.
export function AlphabetTab({
  letter,
  href,
  className,
}: {
  letter: string;
  href: string;
  className: string;
}) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      onClick={() => revealLetter(letter)}
      className={className}
    >
      {letter}
    </Link>
  );
}

// An address that already ends with a letter (a reload, a shared link):
// the list streams in after the browser has looked for the anchor, so the
// page goes to the letter once the section is there.
export function LetterFromAddress() {
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash);

    if (hash.startsWith("#letter-")) {
      revealLetter(hash.slice("#letter-".length));
    }
  }, []);

  return null;
}
