import clsx from "clsx"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import { Button } from "@/components/ui/button"
import { ApplicationCard } from "./ApplicationCard"
import { cn } from "@/lib/utils"
import { JSX } from "react"
import Link from "next/link"
import { MeilisearchResponseAppsIndex } from "src/codegen"

export const ApplicationSectionGradient = ({
  mobile,
  moreLinkLabel,
  moreLink,
  title,
  description,
  logo,
}: {
  mobile: Pick<MeilisearchResponseAppsIndex, "hits">
  moreLink: string
  moreLinkLabel: string
  title: string
  description?: string
  logo: JSX.Element
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col lg:flex-row",
        "bg-gradient-to-r from-[#c6eaf8] to-[#c4f3c9] dark:from-[#2f3d9f] dark:to-[#682889]",
        "p-4 pb-6 pt-9 md:p-12 md:pe-9 rounded-xl gap-4",
      )}
    >
      <div className="flex flex-col gap-4 items-center lg:items-start justify-center lg:w-1/3">
        <div className="w-full max-w-64 md:max-w-80">{logo}</div>
        <h1 className="lg:pt-3 text-5xl md:text-6xl font-black">{title}</h1>
        {description && <div>{description}</div>}
        <Button
          asChild
          variant="secondary"
          size="xl"
          className={cn(
            "dark:bg-flathub-white/15 bg-flathub-black/10",
            "transition duration-300 hover:bg-flathub-black/20 dark:hover:bg-flathub-white/25",
            "active:bg-flathub-black/40 dark:active:bg-flathub-white/50",
            "rounded-full px-8 hidden lg:flex w-fit",
          )}
          aria-label={moreLinkLabel}
          title={moreLinkLabel}
        >
          <Link href={moreLink}>{moreLinkLabel}</Link>
        </Button>
      </div>
      <div className="pt-5 lg:pt-0 grid grid-cols-1 md:grid-cols-2 gap-1.5 lg:w-2/3">
        {mobile.hits.map(mapAppsIndexToAppstreamListItem).map((app) => (
          <ApplicationCard
            key={app.id}
            size="sm"
            variant="flat"
            application={app}
          />
        ))}
      </div>
      <div className="flex justify-center lg:hidden ">
        <Button
          asChild
          variant="secondary"
          size="xl"
          className={cn(
            "dark:bg-flathub-white/15 bg-flathub-black/10",
            "transition duration-300 hover:bg-flathub-black/20 dark:hover:bg-flathub-white/25",
            "rounded-full px-8 w-fit",
          )}
          aria-label={moreLinkLabel}
          title={moreLinkLabel}
        >
          <Link href={moreLink}>{moreLinkLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
