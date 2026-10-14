import clsx from "clsx"
import { useTranslations } from "next-intl"
import {
  CircleCheck,
  CircleHelp,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react"
import type { PlatformSupportStatus } from "./platform-support"

const PlatformSupportSummary = ({
  status,
  appName,
  variant,
}: {
  status: PlatformSupportStatus
  appName: string
  variant: "compact" | "modal"
}) => {
  const t = useTranslations()
  const isAdaptive = status === "adaptive"
  const isMobileOnly = status === "mobile-only"
  const isDesktopOnly = status === "desktop-only"
  const isSpecific = status === "specific"
  const isCompact = variant === "compact"

  const badgeClass = clsx(
    "inline-flex items-center justify-center rounded-full",
    isAdaptive
      ? "bg-flathub-status-green/25 text-flathub-status-green dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
      : "bg-flathub-gainsborow/40 text-flathub-sonic-silver dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
    isCompact
      ? isAdaptive
        ? "h-8 gap-1 px-2.5"
        : "h-8 w-8 p-1.5"
      : isAdaptive
        ? "h-16 gap-1 px-5"
        : "h-16 w-16 p-3",
  )

  const label = isCompact
    ? isAdaptive
      ? t("platform-support.adaptive")
      : isMobileOnly
        ? t("platform-support.mobile-only")
        : isDesktopOnly
          ? t("platform-support.desktop-only")
          : t("platform-support.support-unknown")
    : isAdaptive
      ? t("platform-support.appname-works-on-most-devices", { appName })
      : isSpecific
        ? t("platform-support.appname-works-best-on-specific-hardware", {
            appName,
          })
        : t("platform-support.appname-hardware-support", { appName })

  return (
    <span
      className={clsx(
        "flex flex-col items-center",
        isCompact ? "gap-1" : "gap-2",
      )}
    >
      <span className={badgeClass} aria-hidden="true">
        {isAdaptive && isCompact ? (
          <>
            <Smartphone className="h-5 w-5" strokeWidth={2.5} />
            <Tablet
              className={clsx("h-6 w-6 rotate-90", !isCompact && "h-7 w-7")}
              strokeWidth={2.5}
            />
            <Monitor
              className={clsx("h-6 w-6", !isCompact && "h-7 w-7")}
              strokeWidth={2.5}
            />
          </>
        ) : isAdaptive ? (
          <CircleCheck className="h-8 w-8" strokeWidth={2.5} />
        ) : isMobileOnly ? (
          <Smartphone className="h-full w-full" />
        ) : isDesktopOnly ? (
          <Monitor className="h-full w-full" />
        ) : (
          <CircleHelp className="h-full w-full" />
        )}
      </span>
      <span
        className={clsx(
          "text-center",
          isCompact
            ? "text-xs text-flathub-sonic-silver dark:text-flathub-lotion"
            : "text-lg font-semibold",
        )}
      >
        {label}
      </span>
    </span>
  )
}

export default PlatformSupportSummary
