import clsx from "clsx"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import { JSX, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import MultiToggle from "../MultiToggle"
import ApplicationSection from "./ApplicationSection"
import { MeilisearchResponseAppsIndex } from "src/codegen"

export const ApplicationSectionGradientMultiToggle = ({
  apps,
  sectionKey,
  title,
  description,
  logo,
}: {
  apps: {
    name: string
    apps: MeilisearchResponseAppsIndex
    moreLink: string
    moreLinkLabel: string
  }[]
  sectionKey: string
  title: string
  description?: string
  logo: JSX.Element
}) => {
  const t = useTranslations()

  const [selectedName, setSelectedName] = useState<string>(apps[0].name)
  const [selectedApps, setSelectedApps] = useState<{
    name: string
    apps: MeilisearchResponseAppsIndex
    moreLink: string
    moreLinkLabel: string
  }>(apps.find((x) => x.name === selectedName) || apps[0])

  useEffect(() => {
    const foundApps = apps.find(
      (sectionData) => sectionData.name === selectedName,
    )
    setSelectedApps(foundApps)
  }, [selectedName, apps])

  return (
    <div
      className={clsx(
        "flex flex-col lg:flex-row",
        "bg-linear-to-r from-[#fdcde0] to-[#b0e5f0] dark:from-[#821756] dark:to-[#136673]",
        "p-4 pb-6 pt-9 md:p-12 md:pe-9 rounded-xl gap-4",
      )}
    >
      <ApplicationSection
        type="withCustomHeaderAndTransparent"
        key={`${sectionKey}${selectedApps.name}`}
        href={selectedApps.moreLink}
        applications={selectedApps.apps.hits.map((app) =>
          mapAppsIndexToAppstreamListItem(app),
        )}
        numberOfApps={12}
        customHeader={
          <div className="flex flex-col gap-10 justify-center items-center">
            <div className="flex flex-col gap-4 items-center justify-center">
              <div className="w-full max-w-64 md:max-w-80">{logo}</div>
              <h1 className="text-center pt-3 text-5xl md:text-6xl font-black">
                {title}
              </h1>
              {description && <div className="text-center">{description}</div>}
            </div>
            <MultiToggle
              items={apps.map((section) => ({
                id: section.name,
                content: (
                  <div className="font-semibold truncate">
                    {t(section.name)}
                  </div>
                ),
                selected: section.name === selectedName,
                onClick: () => {
                  setSelectedName(section.name)
                },
              }))}
              size={"lg"}
              variant="flat"
            />
          </div>
        }
        showMore={true}
        moreText={t(selectedApps.moreLinkLabel)}
      />
    </div>
  )
}
