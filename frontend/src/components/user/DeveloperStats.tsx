import { FunctionComponent, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useUserContext } from "../../context/user-info"
import { useQueries } from "@tanstack/react-query"
import { getStatsForAppStatsAppIdGet } from "src/codegen/stats/stats"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const DeveloperStats: FunctionComponent = () => {
  const t = useTranslations()
  const user = useUserContext()

  const appIds: string[] = user.info?.dev_flatpaks || []

  const queries = useQueries({
    queries: appIds.map((id) => ({
      queryKey: ["stats", id],
      queryFn: () => getStatsForAppStatsAppIdGet(id),
      enabled: !!user.info && !!id,
      staleTime: 1000 * 60 * 60 * 24, // 1 day
    })),
  })

  const loading = queries.some((q) => q.isFetching || q.isLoading)

  const aggregated = useMemo(() => {
    const totalLast7 = queries.reduce((acc, q) => {
      const v = q.data?.data?.installs_last_7_days ?? 0
      return acc + v
    }, 0)

    return totalLast7
  }, [queries])

  if (user.loading || !user.info) {
    return null
  }

  if (!appIds || appIds.length === 0) {
    return null
  }

  return loading ? (
    <Card>
      <CardHeader className="flex items-center flex-col">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </div>
      </CardContent>
    </Card>
  ) : (
    <Card className="p-4">
      <h3 className="my-4 mt-0 text-xl font-semibold text-center">
        {t("developer-portal.downloads-last-week")}
      </h3>
      <div className="flex flex-col items-center text-center">
        <div className="text-3xl font-bold text-flathub-celestial-blue">
          {aggregated.toLocaleString()}
        </div>
        <span className="text-flathub-sonic-silver text-base font-medium mt-1">
          {aggregated === 0
            ? t("developer-portal.no-downloads-last-week")
            : t("developer-portal.some-downloads-last-week")}
        </span>
      </div>
    </Card>
  )
}

export default DeveloperStats
