import { FunctionComponent, useState, createElement } from "react"
import { useLocale, useTranslations } from "next-intl"
import clsx from "clsx"
import { ScaleIcon, Users2Icon, FileTextIcon, Monitor } from "lucide-react"
import { calculateHumanReadableSize } from "../../../size"
import { getIntlLocale } from "../../../localize"
import {
  AppSafetyRating,
  safetyRatingToTranslationKey,
  safetyRatingToColor,
  safetyRatingToIcon,
} from "../../../safety"
import { Summary } from "../../../types/Summary"
import { GetAppstreamAppstreamAppIdGet200, StatsResultApp } from "src/codegen"
import SubHeaderItem from "./SubHeaderItem"
import DownloadSizeModal from "./DownloadSizeModal"
import LicenseModal from "./LicenseModal"
import SafetyModal from "./SafetyModal"
import PlatformModal from "./PlatformModal"
import StatsModal from "./StatsModal"
import ContentRatingModal from "./ContentRatingModal"
import { getContentRating, ageToColor } from "src/contentRating"

interface SubHeaderProps {
  app: GetAppstreamAppstreamAppIdGet200
  summary: Summary | null
  stats: StatsResultApp | null
  safetyRating: AppSafetyRating[]
}

const SubHeader: FunctionComponent<SubHeaderProps> = ({
  app,
  summary,
  stats,
  safetyRating,
}) => {
  const t = useTranslations()
  const locale = useLocale()

  const [downloadSizeOpen, setDownloadSizeOpen] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [contentRatingOpen, setContentRatingOpen] = useState(false)

  const highestSafetyRating =
    safetyRating.length > 0
      ? Math.max(...safetyRating.map((x) => x.safetyRating))
      : 0

  const isMobileFriendly = "isMobileFriendly" in app && !!app.isMobileFriendly

  const licenseType =
    !app.project_license ||
    app.project_license?.startsWith("LicenseRef-proprietary")
      ? "proprietary"
      : app.is_free_license
        ? "floss"
        : "special"

  const summaryIcons = safetyRating
    .filter(
      (x) =>
        x.showOnSummaryOrDetails === "summary" ||
        x.showOnSummaryOrDetails === "both",
    )
    .sort((a, b) => b.safetyRating - a.safetyRating)
    .slice(0, 3)

  const contentRating =
    "content_rating_details" in app && app.content_rating_details
      ? getContentRating(app, locale)
      : null

  const items: React.ReactNode[] = []

  // Download Size
  if (summary) {
    items.push(
      <SubHeaderItem key="download" onClick={() => setDownloadSizeOpen(true)}>
        <span className="inline-flex items-center rounded-full bg-flathub-gainsborow/60 px-3 py-1 text-sm font-bold leading-none tabular-nums dark:bg-flathub-granite-gray/60">
          {calculateHumanReadableSize(summary.download_size, true)}
        </span>
        <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
          {t("sub-header.download")}
        </span>
      </SubHeaderItem>,
    )
  }

  // License
  items.push(
    <SubHeaderItem key="license" onClick={() => setLicenseOpen(true)}>
      <div
        className={clsx(
          "flex h-8 items-center gap-1 rounded-full px-2",
          licenseType === "floss"
            ? "text-flathub-dark-gunmetal bg-flathub-gainsborow/60 dark:bg-flathub-granite-gray/60 dark:text-flathub-lotion"
            : "text-flathub-status-yellow bg-flathub-status-yellow/20 dark:bg-flathub-status-yellow-dark/20 dark:text-flathub-status-yellow-dark",
        )}
      >
        {licenseType === "floss" ? (
          <>
            <Users2Icon className="h-4 w-4" aria-hidden />
            <ScaleIcon className="h-4 w-4" aria-hidden />
          </>
        ) : (
          <>
            <ScaleIcon className="h-4 w-4" aria-hidden />
            <FileTextIcon className="h-4 w-4" aria-hidden />
          </>
        )}
      </div>
      <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
        {licenseType === "floss"
          ? t("sub-header.free")
          : licenseType === "special"
            ? t("special-license")
            : t("proprietary")}
      </span>
    </SubHeaderItem>,
  )

  // Safety Rating
  if (safetyRating.length > 0) {
    const isSafe = highestSafetyRating === 1
    const safetyIcons = summaryIcons
      .filter((x) => x.safetyRating === highestSafetyRating)
      .slice(0, isSafe ? 1 : 2)
    const iconsToRender =
      safetyIcons.length > 0 ? safetyIcons : [{ icon: undefined }]
    items.push(
      <SubHeaderItem key="safety" onClick={() => setSafetyOpen(true)}>
        <div
          className={clsx(
            "flex items-center rounded-full",
            isSafe ? "h-8 w-8 p-1.5" : "h-8 gap-1 px-2",
            safetyRatingToColor(highestSafetyRating),
          )}
        >
          {iconsToRender.map((item, i) =>
            item.icon
              ? createElement(item.icon, {
                  key: i,
                  className: isSafe ? "w-full h-full" : "h-4 w-4",
                  "aria-hidden": true,
                })
              : createElement(
                  "span",
                  { key: i },
                  safetyRatingToIcon(highestSafetyRating),
                ),
          )}
        </div>
        <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
          {t(safetyRatingToTranslationKey(highestSafetyRating))}
        </span>
      </SubHeaderItem>,
    )
  }

  // Platform
  items.push(
    <SubHeaderItem key="platform" onClick={() => setPlatformOpen(true)}>
      <div
        className={clsx(
          "h-8 w-8 rounded-full p-1.5",
          isMobileFriendly
            ? "text-flathub-status-green bg-flathub-status-green/20 dark:bg-flathub-status-green-dark/20 dark:text-flathub-status-green-dark"
            : "text-flathub-dark-gunmetal bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray/60 dark:text-flathub-lotion",
        )}
      >
        <Monitor className="w-full h-full" />
      </div>
      <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
        {isMobileFriendly
          ? t("sub-header.desktop-and-mobile")
          : t("sub-header.desktop-only")}
      </span>
    </SubHeaderItem>,
  )

  // Age Rating
  if (contentRating) {
    const ageLabel =
      contentRating.minimumAge === null
        ? "3+"
        : `${Math.max(contentRating.minimumAge, 3)}+`

    items.push(
      <SubHeaderItem
        key="content-rating"
        onClick={() => setContentRatingOpen(true)}
      >
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold leading-none tabular-nums",
            ageToColor(contentRating.minimumAge),
          )}
        >
          {ageLabel}
        </span>
        <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
          {t("sub-header.age-rating")}
        </span>
      </SubHeaderItem>,
    )
  }

  // Downloads/Month - always show, defaulting to 0
  const installsLastMonth = stats?.installs_last_month ?? 0
  items.push(
    <SubHeaderItem key="stats" onClick={() => setStatsOpen(true)}>
      <span className="inline-flex items-center rounded-full bg-flathub-gainsborow/60 px-3 py-1 text-sm font-bold leading-none tabular-nums dark:bg-flathub-granite-gray/60">
        {installsLastMonth.toLocaleString(getIntlLocale(locale))}
      </span>
      <span className="text-xs text-flathub-sonic-silver dark:text-flathub-lotion">
        {t("sub-header.downloads-per-month")}
      </span>
    </SubHeaderItem>,
  )

  return (
    <>
      <section
        aria-label={t("app-information")}
        className="col-start-2 flex flex-wrap items-stretch justify-between pb-4"
      >
        {items}
      </section>

      {/* Modals */}
      {summary && (
        <DownloadSizeModal
          isOpen={downloadSizeOpen}
          onClose={() => setDownloadSizeOpen(false)}
          summary={summary}
        />
      )}

      <LicenseModal
        isOpen={licenseOpen}
        onClose={() => setLicenseOpen(false)}
        app={app}
      />

      {safetyRating.length > 0 && (
        <SafetyModal
          isOpen={safetyOpen}
          onClose={() => setSafetyOpen(false)}
          appName={app.name}
          safetyRating={safetyRating}
        />
      )}

      {contentRating && (
        <ContentRatingModal
          isOpen={contentRatingOpen}
          onClose={() => setContentRatingOpen(false)}
          contentRating={contentRating}
          appName={app.name}
        />
      )}

      <PlatformModal
        isOpen={platformOpen}
        onClose={() => setPlatformOpen(false)}
        appName={app.name}
        isMobileFriendly={isMobileFriendly}
      />

      <StatsModal
        isOpen={statsOpen}
        onClose={() => setStatsOpen(false)}
        stats={
          stats ?? {
            installs_total: 0,
            installs_per_day: {},
            installs_per_country: {},
            installs_last_month: 0,
            installs_last_7_days: 0,
            id: app.id,
          }
        }
        locale={locale}
      />
    </>
  )
}

export default SubHeader
