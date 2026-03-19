import { createElement } from "react"
import clsx from "clsx"
import { safetyRatingToColor, safetyRatingToIcon } from "../../../safety"

export const SafetyIcon = ({
  safetyRating,
  icon,
  size = "size-8",
}: {
  safetyRating: number
  icon?: React.ElementType
  size?: "size-8" | "size-10" | "size-16"
}) => {
  const padding = size === "size-8" ? "p-1.5" : "p-2"

  return (
    <div
      className={clsx(
        size,
        padding,
        "rounded-full",
        safetyRatingToColor(safetyRating),
      )}
    >
      {icon
        ? createElement(icon, {
            className: "w-full h-full",
            "aria-hidden": true,
          })
        : safetyRatingToIcon(safetyRating)}
    </div>
  )
}
