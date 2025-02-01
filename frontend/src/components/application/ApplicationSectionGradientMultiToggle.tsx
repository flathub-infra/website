import clsx from "clsx"
import {
  AppsIndex,
  mapAppsIndexToAppstreamListItem,
  MeilisearchResponse,
} from "src/meilisearch"
import { JSX, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import MultiToggle from "../MultiToggle"
import ApplicationSection from "./ApplicationSection"

export const ApplicationSectionGradientMultiToggle = ({
  apps,
  sectionKey,
  title,
  description,
  logo,
}: {
  apps: {
    name: string
    apps: MeilisearchResponse<AppsIndex>
    moreLink: string
    moreLinkLabel: string
  }[]
  sectionKey: string
  title: string
  description?: string
  logo: JSX.Element
}) => {
  const { t } = useTranslation()

  const [selectedName, setSelectedName] = useState<string>(apps[0].name)
  const [selectedApps, setSelectedApps] = useState<{
    name: string
    apps: MeilisearchResponse<AppsIndex>
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
        "bg-gradient-to-r from-[#ddf5fa] to-[#fddbe8] dark:from-[#02353d] dark:to-[#580034]",
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
              {logo}
              <h1 className="lg:pt-3 text-5xl md:text-6xl font-black">
                {title}
              </h1>
              {description && <div>{description}</div>}
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
