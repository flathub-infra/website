import clsx from "clsx"
import { Monitor, Smartphone, Tablet } from "lucide-react"

const AdaptiveDevicesIcon = ({
  adaptive,
  className,
}: {
  adaptive: boolean
  className?: string
}) => (
  <div
    aria-hidden="true"
    className={clsx(
      "inline-flex items-center justify-center gap-1 rounded-full",
      adaptive
        ? "bg-flathub-status-green/25 text-flathub-status-green dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
        : "bg-flathub-gainsborow/40 text-flathub-sonic-silver dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
      className,
    )}
  >
    <Smartphone className="h-5 w-5" strokeWidth={2.5} />
    <Tablet className="h-6 w-6 rotate-90" strokeWidth={2.5} />
    <Monitor className="h-6 w-6" strokeWidth={2.5} />
  </div>
)

export default AdaptiveDevicesIcon
