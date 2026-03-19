import { createElement } from "react"
import clsx from "clsx"

const LicenseIconCircle = ({
  color,
  icon,
}: {
  color: "green" | "yellow"
  icon: React.ElementType
}) => (
  <div
    className={clsx(
      "h-8 w-8 rounded-full p-1.5",
      color === "green" &&
        "text-flathub-status-green bg-flathub-status-green/20 dark:bg-flathub-status-green-dark/20 dark:text-flathub-status-green-dark",
      color === "yellow" &&
        "text-flathub-status-yellow bg-flathub-status-yellow/20 dark:bg-flathub-status-yellow-dark/20 dark:text-flathub-status-yellow-dark",
    )}
  >
    {createElement(icon, { className: "w-full h-full", "aria-hidden": true })}
  </div>
)

export default LicenseIconCircle
