"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Toasts look like the landing CTA: a dark pill with light text.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-18 text-btn-dot" />
        ),
        info: (
          <InfoIcon className="size-18 text-btn-dot" />
        ),
        warning: (
          <TriangleAlertIcon className="size-18 text-sticker" />
        ),
        error: (
          <OctagonXIcon className="size-18 text-sticker" />
        ),
        loading: (
          <Loader2Icon className="size-18 animate-spin text-btn-dot" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-ink-strong)",
          "--normal-text": "var(--color-btn-text)",
          "--normal-border": "var(--color-ink-strong)",
          "--border-radius": "var(--radius-pill)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans! text-cta! font-bold! px-22! shadow-sticker!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
