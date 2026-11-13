import { useTranslations } from "next-intl"
import { getIntlLocale } from "../../../localize"
import { StatsResultApp } from "src/codegen"
import Modal from "../../Modal"
import AppStatistics from "../AppStats"
import Tabs, { Tab } from "../../Tabs"
import { UTCDate } from "@date-fns/utc"
import CountryStatistics from "src/components/charts/CountryStatistics"
import { useState } from "react"

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
  const [normalizePopulation, setNormalizePopulation] = useState(false)

  const countryStatisticsStartDate = new UTCDate(2024, 3, 15)

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
      <div className="w-full">
        <CountryStatistics
          metric="installs"
          normalization={{
            enabled: normalizePopulation,
            onChange: setNormalizePopulation,
          }}
          stats={{
            countries: stats.installs_per_country,
            country_population: stats.country_population,
          }}
          periodLabel={t("since-x", {
            date: countryStatisticsStartDate.toLocaleDateString(
              getIntlLocale(locale),
            ),
          })}
        />
      </div>
    ),
    replacePadding: "p-4 sm:p-5",
  })

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      title={
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>{t("statistics")}</span>
          <span className="text-xs font-normal text-foreground/70">
            {t("sub-header.total-installs", {
              count: stats.installs_total.toLocaleString(getIntlLocale(locale)),
            })}
          </span>
        </span>
      }
      size="xl"
    >
      {tabs.length > 1 ? (
        <Tabs tabs={tabs} tabsIdentifier="stats-modal" />
      ) : (
        tabs[0].content
      )}
    </Modal>
  )
}

export default StatsModal
