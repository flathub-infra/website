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
        className="text-4xl leading-tight font-black text-flathub-dark-gunmetal md:text-5xl dark:text-flathub-gainsborow"
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
        className="overflow-hidden rounded-xl bg-linear-to-r from-[#2dccb5] to-[#48cfca] p-6 text-flathub-dark-gunmetal shadow-md md:px-8 md:pt-8 md:pb-0 dark:from-[#174f4b] dark:via-[#195c58] dark:to-[#234b65] dark:text-flathub-gainsborow"
      >
        {header}
        <div
          className={cn(
            "grid grid-cols-1 gap-8 md:gap-x-10 md:gap-y-8",
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
                <div className="mb-4 flex min-h-16 items-center gap-4">
                  <div className="relative flex h-[64px] w-[64px] shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[96px] md:w-[96px]">
                    <LogoImage
                      iconUrl={app.icon}
                      appName={app.name}
                      size={96}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-bold text-flathub-dark-gunmetal group-hover:underline dark:text-flathub-gainsborow">
                      {app.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
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
                    fill
                    trim={{ threshold: 50, color: "FF00FF" }}
                    pictureClassName="block aspect-[9/4] w-full overflow-hidden rounded-md"
                    className="size-full rounded-md object-cover object-top"
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
