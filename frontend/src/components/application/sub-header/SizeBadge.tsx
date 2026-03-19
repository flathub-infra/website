import clsx from "clsx"

const SizeBadge = ({ size }: { size: string }) => (
  <span
    className={clsx(
      "inline-flex items-center justify-center whitespace-nowrap",
      "rounded-full px-3 py-1 text-sm font-bold tabular-nums",
      "bg-flathub-celestial-blue/10 dark:bg-flathub-celestial-blue/15",
      "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
      "min-w-[64px] ring-1 ring-flathub-celestial-blue/20 dark:ring-flathub-celestial-blue/15",
    )}
  >
    {size}
  </span>
)

export default SizeBadge
