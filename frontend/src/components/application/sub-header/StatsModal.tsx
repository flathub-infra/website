import { useTranslations } from "next-intl"
import { getIntlLocale } from "../../../localize"
import { StatsResultApp } from "src/codegen"
import Modal from "../../Modal"
import AppStatistics from "../AppStats"
import CountryMap, { type CountryMapValue } from "@/components/ui/country-map"
import Tabs, { Tab } from "../../Tabs"
import { UTCDate } from "@date-fns/utc"

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

  const countryData: CountryMapValue[] = stats.installs_per_country
    ? Object.entries(stats.installs_per_country).map(([key, value]) => ({
        country: key,
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
        <CountryMap
          data={countryData}
          ariaLabel={t("country-statistics")}
          metric="installs"
        />
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
        {t("sub-header.total-installs", {
          count: stats.installs_total.toLocaleString(getIntlLocale(locale)),
        })}
      </div>
      <Tabs tabs={tabs} tabsIdentifier="stats-modal" />
    </Modal>
  )
}

export default StatsModal
