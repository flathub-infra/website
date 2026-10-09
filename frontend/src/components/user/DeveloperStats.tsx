import { ChartColumnIncreasing } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useQueries } from "@tanstack/react-query"
import { FunctionComponent } from "react"
import { getStatsForAppStatsAppIdGet } from "src/codegen/stats/stats"
import { useUserContext } from "../../context/user-info"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const DeveloperStats: FunctionComponent = () => {
  const t = useTranslations()
  const locale = useLocale()
  const user = useUserContext()
  const appIds = user.info?.dev_flatpaks ?? []

  const queries = useQueries({
    queries: appIds.map((id) => ({
      queryKey: ["stats", id],
      queryFn: () => getStatsForAppStatsAppIdGet(id),
      enabled: !!user.info && !!id,
      staleTime: 1000 * 60 * 60 * 24,
    })),
  })

  if (user.loading || !user.info || appIds.length === 0) {
    return null
  }

  const loading = queries.some((query) => query.isLoading || query.isFetching)
  const hasError = queries.some((query) => query.isError)
  const totalDownloads = queries.reduce(
    (total, query) => total + (query.data?.data?.installs_last_7_days ?? 0),
    0,
  )

  if (loading) {
    return (
      <Card aria-label={t("developer-portal.downloads-last-week")}>
        <CardContent className="flex items-center justify-between gap-6 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-l-4 border-l-flathub-celestial-blue py-0">
      <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-flathub-celestial-blue/10 text-flathub-celestial-blue dark:bg-flathub-celestial-blue/20">
            <ChartColumnIncreasing aria-hidden="true" className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {t("developer-portal.downloads-last-week")}
            </h2>
            <p className="mt-1 text-sm text-flathub-granite-gray dark:text-flathub-white/80">
              {t("developer-portal.downloads-across-apps")}
            </p>
          </div>
        </div>
        {hasError ? (
          <p
            className="text-sm font-medium text-flathub-granite-gray dark:text-flathub-white/80"
            role="status"
          >
            {t("developer-portal.downloads-unavailable")}
          </p>
        ) : (
          <p
            className="text-3xl font-bold tabular-nums tracking-tight text-flathub-arsenic sm:text-4xl dark:text-flathub-white"
            aria-live="polite"
          >
            {new Intl.NumberFormat(locale).format(totalDownloads)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default DeveloperStats
