"use client";

import { useEffect } from "react";

import { setBookmarkUser } from "@/lib/bookmark-store";

// Tells the bookmark ribbon who is signed in, so it never leads to another
// user's card. Put by AccountBar, which knows the user; gone on the sign-in
// pages, and then the ribbon is plain.
export function BookmarkUser({ userId }: { userId: string }) {
  useEffect(() => {
    setBookmarkUser(userId);

    return () => setBookmarkUser(null);
  }, [userId]);

  return null;
}
