import { ChartColumnIncreasing } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { FunctionComponent } from "react"
import { getStatsForAppStatsAppIdGet } from "src/codegen/stats/stats"
import type { GetAppstreamAppstreamAppIdGet200 } from "src/codegen/model/getAppstreamAppstreamAppIdGet200"
import type { AppstreamListItem } from "../../types/Appstream"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  application: GetAppstreamAppstreamAppIdGet200 | AppstreamListItem
}

const DeveloperStats: FunctionComponent<Props> = ({ application }) => {
  const t = useTranslations()
  const locale = useLocale()
  const query = useQuery({
    queryKey: ["stats", application.id],
    queryFn: () => getStatsForAppStatsAppIdGet(application.id),
    staleTime: 1000 * 60 * 60 * 24,
  })

  if (query.isLoading) {
    return (
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-flathub-granite-gray dark:text-flathub-white/80">
          <ChartColumnIncreasing aria-hidden="true" className="size-4" />
          {t("developer-portal.downloads-last-month")}
        </span>
        <Skeleton className="h-5 w-16" />
      </div>
    )
  }

  const monthlyInstalls = query.data?.data?.installs_last_month

  return (
    <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-flathub-granite-gray dark:text-flathub-white/80">
        <ChartColumnIncreasing aria-hidden="true" className="size-4" />
        {t("developer-portal.downloads-last-month")}
      </span>
      {query.isError || monthlyInstalls == null ? (
        <span
          className="text-sm font-medium text-flathub-granite-gray dark:text-flathub-white/80"
          role="status"
        >
          {t("developer-portal.downloads-unavailable")}
        </span>
      ) : (
        <span
          className="text-base font-semibold tabular-nums text-flathub-arsenic dark:text-flathub-white"
          aria-label={t("developer-portal.downloads-last-month-count", {
            count: new Intl.NumberFormat(locale).format(monthlyInstalls),
          })}
        >
          {new Intl.NumberFormat(locale).format(monthlyInstalls)}
        </span>
      )}
    </div>
  )
}

export default DeveloperStats
