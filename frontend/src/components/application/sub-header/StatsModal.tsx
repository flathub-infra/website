import { useRef, useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { getIntlLocale } from "../../../localize"
import { StatsResultApp } from "src/codegen"
import Modal from "../../Modal"
import AppStatistics from "../AppStats"
import WorldMap, { type DataItem } from "react-svg-worldmap"
import Tabs, { Tab } from "../../Tabs"
import { UTCDate } from "@date-fns/utc"

const ContainerWorldMap = ({
  countryData,
}: {
  countryData: DataItem<number>[]
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapSize, setMapSize] = useState(480)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMapSize(Math.floor(entry.contentRect.width))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full [&_figure]:!m-0">
      <WorldMap
        color="oklch(var(--color-primary))"
        backgroundColor="oklch(var(--bg-color-secondary))"
        borderColor="oklch(var(--text-primary))"
        size={mapSize}
        data={countryData}
      />
    </div>
  )
}

const StatsModal = ({
  isOpen,
  onClose,
  stats,
  locale,
}: {
  isOpen: boolean
  onClose: () => void
  stats: StatsResultApp
  locale: string
}) => {
  const t = useTranslations()

  const countryStatisticsStartDate = new UTCDate(2024, 3, 15)

  const countryData: DataItem<number>[] = stats.installs_per_country
    ? Object.entries(stats.installs_per_country).map(([key, value]) => ({
        country: key as DataItem<number>["country"],
        value: value as number,
      }))
    : []

  const tabs: Tab[] = []

  if (
    stats.installs_per_day &&
    Object.keys(stats.installs_per_day).length > 10
  ) {
    tabs.push({
      name: t("statistics"),
      content: <AppStatistics stats={stats} />,
      replacePadding: "p-0",
    })
  }

  tabs.push({
    name: t("country-statistics"),
    content: (
      <div className="flex flex-col items-center p-4 w-full">
        <ContainerWorldMap countryData={countryData} />
        <p className="mt-2 text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("since-x", {
            date: countryStatisticsStartDate.toLocaleDateString(
              getIntlLocale(locale),
            ),
          })}
        </p>
      </div>
    ),
    replacePadding: "p-0",
  })

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      title={t("statistics")}
      size="xl"
    >
      <div className="flex justify-end pb-2 text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray">
        {stats.installs_total.toLocaleString(getIntlLocale(locale))}{" "}
        {t("sub-header.total-installs")}
      </div>
      <Tabs tabs={tabs} tabsIdentifier="stats-modal" />
    </Modal>
  )
}

export default StatsModal
