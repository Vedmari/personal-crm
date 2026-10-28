// Strikes of the pen: a row is struck out before it goes away. The look is
// [data-ink] in globals.css; the element marked data-ink-for holds the text,
// its [data-ink-text] part is what the line goes through.

// As long as the ink-strike animation in globals.css.
const STRIKE_MS = 450;

// Next.js keeps the previous page hidden in the DOM, so only a visible
// element is the one on screen.
export function findInkTarget(key: string): HTMLElement | undefined {
  return [
    ...document.querySelectorAll<HTMLElement>(`[data-ink-for="${key}"]`),
  ].find((element) => element.offsetParent !== null);
}

export function isStruck(element: Element | null | undefined): boolean {
  return element?.getAttribute("data-ink") === "struck";
}

// Strikes the element out and resolves once the line is drawn. With reduced
// motion there is no line and no wait.
export function strike(element: Element | null | undefined): Promise<void> {
  if (
    !element ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return Promise.resolve();
  }

  element.setAttribute("data-ink", "struck");

  return new Promise((resolve) => window.setTimeout(resolve, STRIKE_MS));
}

// Takes the line away again, when the action behind it failed.
export function unstrike(element: Element | null | undefined) {
  element?.removeAttribute("data-ink");
}
