import type { useRouter } from "next/navigation";

import { LIST_PAGE_SIZE, listHref, parseShown, shownFor } from "./list-filter";

const WAIT_FOR_ROW_MS = 5000;
const SCROLL_SETTLE_MS = 1500;
const FLASH_MS = 4000;
// The sticky search bar of the list page covers the top of the viewport (h-64).
const STICKY_HEADER_PX = 64;

function isInView(row: HTMLElement): boolean {
  const box = row.getBoundingClientRect();

  return box.top >= STICKY_HEADER_PX && box.bottom <= window.innerHeight;
}

// Scrolls the list to a contact and flashes its row. The row may not be on the
// page yet (the list is still refreshing), so this keeps looking for a while.
export function revealContact(id: number): void {
  const deadline = performance.now() + WAIT_FOR_ROW_MS;

  const tryReveal = () => {
    const row = document.getElementById(`contact-${id}`);

    if (!row) {
      if (performance.now() < deadline) {
        requestAnimationFrame(tryReveal);
      }
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    row.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    row.setAttribute("data-new", "true");
    window.setTimeout(() => row.removeAttribute("data-new"), FLASH_MS);

    // Rows are laid out lazily, so a long animated scroll can stop short of
    // the target. Once the scroll has settled, jump the rest of the way.
    let settled = false;
    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener("scrollend", settle);

      if (!isInView(row)) {
        row.scrollIntoView({ block: "center", behavior: "auto" });
      }
    };

    window.addEventListener("scrollend", settle);
    window.setTimeout(settle, SCROLL_SETTLE_MS);
  };

  requestAnimationFrame(tryReveal);
}

// After a contact is added or brought back: makes the list of the main screen
// long enough to hold it, clears the search and the group that could hide it,
// and reveals it. A list that is already longer stays as long. Somebody who
// has left the main screen meanwhile is not taken back to it.
export function showContactInList(
  router: ReturnType<typeof useRouter>,
  contact: { id: number; position: number | null },
): void {
  if (window.location.pathname !== "/") {
    return;
  }

  const current = parseShown(
    Object.fromEntries(new URLSearchParams(window.location.search)),
  );
  const needed =
    contact.position === null ? LIST_PAGE_SIZE : shownFor(contact.position);
  const href = listHref({ shown: Math.max(current, needed) });

  if (window.location.pathname + window.location.search !== href) {
    router.replace(href, { scroll: false });
  }

  revealContact(contact.id);
}
