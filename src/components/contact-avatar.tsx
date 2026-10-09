import { cn } from "@/lib/utils";
import { getAvatarHue, getInitials } from "@/lib/format";

const SIZES = {
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

export function ContactAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const hue = getAvatarHue(name);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none",
        SIZES[size],
        className,
      )}
      style={{
        backgroundColor: `oklch(0.93 0.045 ${hue})`,
        color: `oklch(0.4 0.09 ${hue})`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
