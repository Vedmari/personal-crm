import * as React from "react"
import { cn } from "@/lib/utils"

// Lines are 32px; borders and padding add 16px, like an input,
// so the field grows by whole rules of the page.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-80 w-full rounded-md border border-input bg-paper-grid px-14 py-7 font-sans text-body text-ink transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
