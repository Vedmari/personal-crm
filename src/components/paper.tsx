import Link from "next/link";
import { Suspense, ViewTransition } from "react";

import { BookmarkRibbon, PlainRibbon } from "@/components/bookmark-ribbon";
import { cn } from "@/lib/utils";

// Building blocks borrowed from the landing (personal-crm-landing/src/components):
// paper sheets laid out on the green baize.

// The sheets of one page. Clips sideways instead of hiding overflow,
// so sticky parts of a sheet keep sticking to the window.
//
// Every page is built on it, so it is where the pages turn: a link with the
// "page-forward" or "page-back" transition type turns the page over (the
// .page-* view transition classes in globals.css). Any other navigation —
// the browser's Back, search, filters — swaps the page without a turn.
export function Cover({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <ViewTransition
      enter={{
        "page-forward": "page-enter-forward",
        "page-back": "page-enter-back",
        default: "none",
      }}
      exit={{
        "page-forward": "page-leave-forward",
        "page-back": "page-leave-back",
        default: "none",
      }}
      default="none"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-1440 flex-col gap-40 overflow-x-clip pb-56 md:gap-80 md:pb-120",
          className,
        )}
        {...props}
      />
    </ViewTransition>
  );
}

// Side padding inside a diary sheet: the text stops before the red margin line.
export const DIARY_SHEET_X = "pr-72 pl-26 md:pr-hero-r md:pl-hero-l";

// The landing's first screen: a diary page pressed to the left edge,
// with a spine shade, a stack of pages on the right and a bookmark ribbon
// that leads to the last opened card.
export function DiarySheet({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className="pt-14 pr-14 md:pt-28 md:pr-hero-wrap-r">
      <div
        className={cn(
          "relative rounded-r-hero bg-paper paper-diary shadow-hero md:rounded-r-hero-md md:shadow-hero-md",
          className,
        )}
        {...props}
      >
        <Suspense fallback={<PlainRibbon />}>
          <BookmarkRibbon />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

// Quatrefoil mark and the product name, built like the landing logo.
export function Logo() {
  return (
    <Link
      href="/"
      className="flex h-row w-fit items-baseline gap-8 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring md:gap-10"
    >
      <span
        aria-hidden="true"
        className="relative top-3 size-20 flex-none md:size-22"
      >
        <span className="absolute top-0 left-1/4 size-1/2 rounded-full bg-book-cover" />
        <span className="absolute top-1/2 left-1/4 size-1/2 rounded-full bg-book-cover" />
        <span className="absolute top-1/4 left-0 size-1/2 rounded-full bg-book-cover" />
        <span className="absolute top-1/4 left-1/2 size-1/2 rounded-full bg-book-cover" />
        <span className="absolute top-1/4 left-1/4 size-1/2 bg-book-cover" />
      </span>
      <span className="font-serif text-logo font-bold whitespace-nowrap text-ink-strong md:text-logo-md">
        Личная CRM
      </span>
    </Link>
  );
}

// Small caps line, like the dates that open the landing sheets.
export const DATE_LINE_CLASS_NAME =
  "font-sans text-date font-medium text-ink-muted uppercase md:text-date-md";
