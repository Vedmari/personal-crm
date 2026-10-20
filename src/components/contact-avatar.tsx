import { cn } from "@/lib/utils";
import { getAvatarTone, getInitials } from "@/lib/format";

const SIZES = {
  md: "size-40 text-cta",
  lg: "size-64 text-feature",
} as const;

// The inks of the landing. The circle is the same ink washed into the paper.
const TONES = [
  "text-book-cover",
  "text-ink-red",
  "text-ink-blue",
  "text-ink-muted",
] as const;

export function ContactAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full avatar-wash font-serif leading-none font-bold select-none",
        SIZES[size],
        TONES[getAvatarTone(name, TONES.length)],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
