"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Small caps like the dates on the landing sheets, one 32px rule tall.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 font-sans text-date font-medium text-muted-foreground uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 md:text-date-md",
        className
      )}
      {...props}
    />
  )
}

export { Label }
