// Parts of the app's pages, found the way a person sees them.

import type { Page } from "@playwright/test";

// Next keeps the previous page hidden in the DOM after a navigation, so there
// can be two <main>; the visible one is the current page.
export function currentPage(page: Page) {
  return page.locator("main:visible");
}

export function notesSection(page: Page) {
  return currentPage(page).locator("section[aria-labelledby=notes-heading]");
}

export function toast(page: Page, text: string) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}
