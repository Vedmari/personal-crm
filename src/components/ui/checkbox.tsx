"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Based on the shadcn/ui checkbox (base-nova): a small paper box that fills
// with the green of the cover when it is ticked.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-20 shrink-0 items-center justify-center rounded-sm border border-input bg-paper-grid text-btn-text transition-colors outline-none hover:border-ink-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 data-checked:border-book-cover data-checked:bg-book-cover disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-14" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
