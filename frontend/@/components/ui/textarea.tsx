import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"textarea"> & { variant?: "default" | "surface" }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        "text-base",
        variant === "surface"
          ? "rounded-lg border-input/80 bg-card/50 focus-visible:border-ring"
          : "bg-flathub-gainsborow dark:bg-stone-900",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
