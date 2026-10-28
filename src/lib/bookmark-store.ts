"use client";

import { useEffect, useSyncExternalStore } from "react";

import { BOOKMARK_STORAGE_KEY, readBookmark, type Bookmark } from "./notebook";

// The bookmark lives in localStorage of this browser. Another tab reports a
// change with the "storage" event, this tab with its own event.
const CHANGE_EVENT = "notebook-bookmark-change";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
  } catch {
    // Storage can be switched off; then there is no bookmark.
    return null;
  }
}

function write(raw: string | null) {
  try {
    if (raw === null) {
      window.localStorage.removeItem(BOOKMARK_STORAGE_KEY);
    } else {
      window.localStorage.setItem(BOOKMARK_STORAGE_KEY, raw);
    }
  } catch {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// The bookmark of this browser. Null on the server and before hydration.
export function useBookmark(): Bookmark | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  return readBookmark(raw);
}

// The open card puts the bookmark on itself. A rename moves the name along.
export function useBookmarkHere(bookmark: Bookmark) {
  const { id, name } = bookmark;

  useEffect(() => {
    write(JSON.stringify({ id, name }));
  }, [id, name]);
}

// A deleted contact takes its bookmark along.
export function forgetBookmark(contactId: number) {
  if (readBookmark(readRaw())?.id === contactId) {
    write(null);
  }
}
