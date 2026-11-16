"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  BOOKMARK_STORAGE_KEY,
  readBookmark,
  writeBookmark,
  type Bookmark,
} from "./notebook";

// The bookmark lives in localStorage of this browser, together with the user
// who opened the card. Another tab reports a change with the "storage" event,
// this tab with its own event.
const CHANGE_EVENT = "notebook-bookmark-change";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
  } catch {
    // Storage can be switched off; then there is no bookmark.
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
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

  notify();
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Who is signed in in this tab, as the line above the sheet tells
// (BookmarkUser in AccountBar). Null on the sign-in pages and until it is known.
let signedInUserId: string | null = null;

function readUserId(): string | null {
  return signedInUserId;
}

export function setBookmarkUser(userId: string | null) {
  if (signedInUserId !== userId) {
    signedInUserId = userId;
    notify();
  }
}

function useBookmarkUser(): string | null {
  return useSyncExternalStore(subscribe, readUserId, () => null);
}

// The bookmark of the signed-in user in this browser. Null on the server,
// before hydration, and for a bookmark of somebody else.
export function useBookmark(): Bookmark | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  return readBookmark(raw, useBookmarkUser());
}

// The open card puts the bookmark on itself. A rename moves the name along.
export function useBookmarkHere(bookmark: Bookmark) {
  const { id, name } = bookmark;
  const userId = useBookmarkUser();

  useEffect(() => {
    if (userId !== null) {
      write(writeBookmark({ id, name }, userId));
    }
  }, [id, name, userId]);
}

// A deleted contact takes its bookmark along.
export function forgetBookmark(contactId: number) {
  if (readBookmark(readRaw(), signedInUserId)?.id === contactId) {
    write(null);
  }
}

// «Выйти»: the next person in this browser gets no bookmark.
export function forgetAllBookmarks() {
  write(null);
}
