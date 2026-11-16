import { BookmarkUser } from "@/components/bookmark-user";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";

// The line above the sheet, on the baize: the email of the signed-in user and
// «Выйти», small and light so the sheet stays the main thing. Every page has
// it; the sign-in pages have only its empty place, so the sheet stays where
// it is on every page. It also tells the bookmark ribbon who is signed in.
const BAR_CLASS_NAME =
  "mx-auto flex h-row w-full max-w-1440 items-center justify-end gap-10 px-14 pt-8 font-sans text-date text-paper/75 md:px-hero-wrap-r md:text-date-md";

export function AccountBarPlace() {
  return <div aria-hidden="true" className={BAR_CLASS_NAME} />;
}

export async function AccountBar() {
  const user = await getCurrentUser();

  if (!user) {
    return <AccountBarPlace />;
  }

  return (
    <div className={BAR_CLASS_NAME}>
      <BookmarkUser userId={user.id} />
      <span className="min-w-0 truncate">{user.email}</span>
      <span aria-hidden="true">·</span>
      <SignOutButton
        className={cn(
          "rounded-sm whitespace-nowrap underline decoration-paper/40 underline-offset-4 transition-colors hover:text-paper hover:decoration-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:opacity-60",
        )}
      />
    </div>
  );
}
