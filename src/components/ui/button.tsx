import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Pill buttons in the style of the landing's "Открыть приложение".
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-pill border border-transparent font-sans font-bold whitespace-nowrap transition-[background-color,border-color,color] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-18",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-book-cover",
        outline:
          "border-ink-strong/30 bg-transparent text-ink-strong hover:border-ink-strong/60 hover:bg-ink-strong/5 aria-expanded:bg-ink-strong/5",
        ghost:
          "text-muted-foreground hover:bg-ink-strong/6 hover:text-ink-strong aria-expanded:bg-ink-strong/6",
        link: "text-ink-strong underline decoration-ink-muted/50 underline-offset-4 hover:decoration-book-cover",
      },
      size: {
        default: "h-40 gap-10 px-20 text-cta",
        // The landing CTA: 52px tall, may end with a ButtonDot.
        lg: "h-52 gap-28 px-22 text-cta md:pl-26 md:text-cta-md",
        icon: "size-40",
        "icon-sm": "size-36",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// The light circle at the end of the landing CTA, holding an arrow or an icon.
// It reaches into the button padding to stand 10px from the edge, as on the landing.
function ButtonDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="button-dot"
      aria-hidden="true"
      className={cn(
        "-mr-12 flex size-36 shrink-0 items-center justify-center rounded-full bg-btn-dot text-arrow font-normal text-ink-strong",
        className
      )}
      {...props}
    />
  )
}

export { Button, ButtonDot, buttonVariants }
