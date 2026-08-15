import { useTranslations } from "next-intl"
import type { HomepageCuratedAppSelection } from "src/types/CuratedAppSelection"
import { ApplicationCard } from "./ApplicationCard"
import { cn } from "@/lib/utils"
import { Link } from "src/i18n/navigation"
import { findBiggestScreenshotSize } from "src/types/Appstream"
import LogoImage from "../LogoImage"
import { Imgproxy } from "../ImgproxyImage"

const gradientBySlot: Record<HomepageCuratedAppSelection["slot"], string> = {
  "after-hero":
    "from-[#d7f7ff] via-[#eee1ff] to-[#ffe2c8] dark:from-[#11243a] dark:via-[#28215e] dark:to-[#4a2735]",
  "after-top-apps":
    "from-[#f4ffb8] via-[#cdf7dc] to-[#bfe9ff] dark:from-[#263914] dark:via-[#123d31] dark:to-[#11324c]",
  "after-first-category-block":
    "from-[#ffe3a3] via-[#ffc3d8] to-[#d8d2ff] dark:from-[#4a2f10] dark:via-[#4d1832] dark:to-[#2d2863]",
}

interface Props {
  selection: HomepageCuratedAppSelection
}

export function ScheduledAppSelectionSection({ selection }: Props) {
  const t = useTranslations()

  if (selection.apps.length === 0) {
    return null
  }

  const titleKey = `curated-app-selection-themes.${selection.themeKey}.header`
  const descriptionKey = `curated-app-selection-themes.${selection.themeKey}.description`

  if (!t.has(titleKey) || !t.has(descriptionKey)) {
    return null
  }

  const title = t(titleKey)
  const description = t(descriptionKey)
  const headingId = `curated-app-selection-${selection.id}`
  const featured = selection.layout === "featured"
  const header = (
    <div
      className={cn(
        "max-w-3xl",
        featured ? "mb-8" : "mx-auto mb-6 text-center md:mx-0 md:text-start",
      )}
    >
      <h2
        id={headingId}
        className="text-4xl leading-tight font-black md:text-5xl"
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-3 text-base leading-relaxed md:text-lg",
          featured
            ? "text-inherit"
            : "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
        )}
      >
        {description}
      </p>
    </div>
  )

  if (featured) {
    return (
      <section
        aria-labelledby={headingId}
        className="overflow-hidden rounded-xl bg-linear-to-r from-[#2dccb5] to-[#48cfca] p-6 text-flathub-dark-gunmetal shadow-md md:px-8 md:pt-8 md:pb-0"
      >
        {header}
        <div
          className={cn(
            "grid grid-cols-1 gap-8 md:gap-6",
            selection.apps.length > 2
              ? "md:grid-cols-3"
              : selection.apps.length === 2
                ? "md:grid-cols-2"
                : "md:max-w-lg",
          )}
        >
          {selection.apps.map((app) => {
            const screenshot = app.screenshots
              ?.map(findBiggestScreenshotSize)
              .find((image) => image !== undefined)

            return (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="group min-w-0 rounded-lg hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-dark-gunmetal"
              >
                <div className="mb-4 flex min-h-12 items-center gap-3">
                  <LogoImage iconUrl={app.icon} appName={app.name} size={64} />
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-bold text-flathub-dark-gunmetal group-hover:underline">
                      {app.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-flathub-dark-gunmetal">
                      {app.summary}
                    </p>
                  </div>
                </div>
                {screenshot ? (
                  <Imgproxy
                    src={screenshot.src}
                    width={640}
                    height={Math.round(
                      (640 * screenshot.height) / screenshot.width,
                    )}
                    alt=""
                    trim={{ threshold: 50, color: "FF00FF" }}
                    pictureClassName="block md:h-44 lg:h-56"
                    className="h-auto w-full rounded-md"
                  />
                ) : null}
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  const gridClassName = cn(
    "grid grid-cols-1 gap-1.5 md:grid-cols-2",
    selection.apps.length > 2 ? "lg:grid-cols-3" : "max-w-5xl",
  )

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-xl bg-linear-to-r p-4 pb-6 pt-9 shadow-md md:p-12 md:pe-9",
        gradientBySlot[selection.slot],
      )}
    >
      {header}
      <div className={gridClassName}>
        {selection.apps.map((app) => (
          <ApplicationCard key={app.id} application={app} variant="flat" />
        ))}
      </div>
    </section>
  )
}
