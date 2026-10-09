const WAIT_FOR_ROW_MS = 5000;
const SCROLL_SETTLE_MS = 1500;
const FLASH_MS = 4000;
// The sticky header of the list page covers the top of the viewport (h-34).
const STICKY_HEADER_PX = 136;

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
