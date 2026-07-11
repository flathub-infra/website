import { useTranslations } from "next-intl"
import type { HomepageCuratedAppSelection } from "src/types/CuratedAppSelection"
import { ApplicationCard } from "./ApplicationCard"
import { cn } from "@/lib/utils"

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
      <div className="mb-6 max-w-3xl">
        <h2 id={headingId} className="text-4xl font-black md:text-5xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-flathub-dark-gunmetal dark:text-flathub-gainsborow md:text-lg">
          {description}
        </p>
      </div>
      <div className={gridClassName}>
        {selection.apps.map((app) => (
          <ApplicationCard key={app.id} application={app} variant="flat" />
        ))}
      </div>
    </section>
  )
}
