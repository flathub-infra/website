import { Check, CircleAlert, Clock3, SkipForward, X } from "lucide-react"
import { cva } from "class-variance-authority"
import { Badge } from "@/components/ui/badge"

const tintedOutcome =
  "border-[color-mix(in_oklch,var(--outcome-color)_25%,transparent)] bg-[color-mix(in_oklch,var(--outcome-color)_6%,transparent)] text-[color:var(--outcome-color)]"

const outcomeVariants = cva("gap-1.5", {
  variants: {
    tone: {
      accepted: [
        tintedOutcome,
        "[--outcome-color:oklch(38%_0.1_155)] dark:[--outcome-color:oklch(83%_0.1_155)]",
      ],
      pending: [
        tintedOutcome,
        "[--outcome-color:oklch(43%_0.1_75)] dark:[--outcome-color:oklch(86%_0.1_85)]",
      ],
      destructive: "border-destructive/25 bg-destructive/5 text-destructive",
      neutral: "",
    },
  },
})

export default function PermissionOutcomeBadge({
  outcome,
}: {
  outcome: string
}) {
  const Icon =
    outcome === "accepted" || outcome === "approved"
      ? Check
      : outcome === "rejected"
        ? X
        : outcome === "error"
          ? CircleAlert
          : outcome === "skipped"
            ? SkipForward
            : Clock3

  return (
    <Badge
      variant="outline"
      className={outcomeVariants({
        tone:
          outcome === "accepted" || outcome === "approved"
            ? "accepted"
            : outcome === "pending"
              ? "pending"
              : outcome === "rejected" || outcome === "error"
                ? "destructive"
                : "neutral",
      })}
      data-outcome={outcome}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="capitalize">{outcome}</span>
    </Badge>
  )
}
