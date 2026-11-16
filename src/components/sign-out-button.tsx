"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/auth-actions";
import { forgetAllBookmarks } from "@/lib/bookmark-store";

// «Выйти» in the line above the sheet: ends the sign-in on this device and
// takes the bookmark along, so the next person here does not see whose card
// was opened last.
export function SignOutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        forgetAllBookmarks();
        startTransition(async () => {
          await signOutAction();
        });
      }}
      className={className}
    >
      Выйти
    </button>
  );
}
