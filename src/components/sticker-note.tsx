import { cn } from "@/lib/utils";

// A sticky note on the cover, like the last block of the landing.
// Used for whole-page messages: nothing found, data failed to load.
export function StickerNote({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-34 py-56 md:py-120">
      <section
        className={cn(
          "flex w-full max-w-560 rotate-2 flex-col gap-14 bg-sticker paper-sticker px-24 pt-30 pb-26 shadow-sticker md:gap-18 md:px-44 md:pt-44 md:pb-40 md:shadow-sticker-md",
          className,
        )}
      >
        <h1 className="font-serif text-sticker-title font-medium text-pretty text-ink md:text-sticker-title-md">
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}

export const STICKER_TEXT_CLASS_NAME =
  "font-hand text-sticker-note font-bold text-pretty text-ink-blue md:text-sticker-note-md";
