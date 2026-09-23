"use client"

import {
  useListPipelinesApiPipelinesGet,
  type ListPipelinesApiPipelinesGetQueryResult,
  type ListPipelinesApiPipelinesGetQueryError,
} from "src/codegen-pipeline"
import type { UseQueryResult } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { useLocale } from "next-intl"
import { getIntlLocale } from "src/localize"
import { toDurationSeries } from "src/builds/pipeline-history"
import { Button } from "@/components/ui/button"
import Breadcrumbs from "src/components/Breadcrumbs"
import { BuildGroup } from "@/components/build/build-group"
import { BuildTimeChart } from "@/components/build/build-time-chart"
import { BuildStatusBanner } from "@/components/build/build-status-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, BarChart3, Layers } from "lucide-react"

type RepoType = "stable" | "beta" | "test"
const repos: { key: RepoType; label: string }[] = [
  { key: "stable", label: "Latest Stable Builds" },
  { key: "beta", label: "Latest Beta Builds" },
  { key: "test", label: "Latest Test Builds" },
]

function RepoHistory({
  appId,
  repo,
  title,
  withChart,
  query,
}: {
  appId: string
  repo: RepoType
  title: string
  withChart: boolean
  query: UseQueryResult<
    ListPipelinesApiPipelinesGetQueryResult,
    ListPipelinesApiPipelinesGetQueryError
  >
}) {
  const locale = useLocale()
  const builds = query.data?.data
  const dateFormatter = new Intl.DateTimeFormat(
    getIntlLocale(locale).toString(),
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  )
  const hasChart =
    withChart &&
    builds &&
    toDurationSeries(builds, (startedAt) => dateFormatter.format(startedAt))
      .length > 0
  return (
    <div className="space-y-4">
      {query.isPending ? (
        <Card>
          <CardContent className="py-8">Loading {repo} builds...</CardContent>
        </Card>
      ) : null}
      {query.isError && !builds ? (
        <Card>
          <CardContent className="py-8 text-destructive">
            Could not load {repo} builds.{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {hasChart && (
        <Card className="border-2">
          <CardHeader className="bg-muted/30 dark:bg-muted/20">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-2xl font-bold">
                Build Duration Trend
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <BuildTimeChart builds={builds} sampleLimit={50} />
          </CardContent>
        </Card>
      )}
      {builds && (
        <BuildGroup
          title={title}
          builds={builds}
          repo={repo}
          limit={50}
          compactEmpty={!withChart}
        />
      )}
      {builds && query.isRefetchError && (
        <p role="alert" className="text-destructive text-sm">
          Refresh failed for {repo}; showing cached builds.
        </p>
      )}
    </div>
  )
}

export default function AppBuildStatusClient({ appId }: { appId: string }) {
  const stableQuery = useListPipelinesApiPipelinesGet(
    {
      app_id: appId,
      app_id_match: "exact",
      target_repo: "stable",
      type: "build",
      limit: 50,
    },
    { query: { refetchInterval: 30000 } },
  )
  const betaQuery = useListPipelinesApiPipelinesGet(
    {
      app_id: appId,
      app_id_match: "exact",
      target_repo: "beta",
      type: "build",
      limit: 50,
    },
    { query: { refetchInterval: 30000 } },
  )
  const testQuery = useListPipelinesApiPipelinesGet(
    {
      app_id: appId,
      app_id_match: "exact",
      target_repo: "test",
      type: "build",
      limit: 50,
    },
    { query: { refetchInterval: 30000 } },
  )
  const queries = [stableQuery, betaQuery, testQuery]
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Breadcrumbs
        pages={[
          { name: "Builds", href: "/builds", current: false },
          { name: appId, href: `/builds/apps/${appId}`, current: true },
        ]}
      />
      <BuildStatusBanner />
      <div className="flex items-center gap-4">
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="wrap-break-word text-4xl font-extrabold">{appId}</h1>
          <p className="mt-2 text-muted-foreground">App build history</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-purple-600" />
          <h2 className="text-3xl font-bold">Build History by Repository</h2>
        </div>
        <p className="text-muted-foreground">
          Recent builds organized by target repository
        </p>
      </div>
      {(stableQuery.dataUpdatedAt > 0 ||
        (queries.some((query) => query.dataUpdatedAt > 0) &&
          queries.some((query) => query.isFetching))) && (
        <p className="text-sm text-muted-foreground">
          {queries.some((query) => query.isFetching)
            ? "Refreshing…"
            : `Updated ${formatDistanceToNow(new UTCDate(stableQuery.dataUpdatedAt), { addSuffix: true })}`}
        </p>
      )}
      <div className="space-y-8">
        {repos.map(({ key, label }, index) => (
          <RepoHistory
            key={key}
            appId={appId}
            repo={key}
            title={label}
            withChart={key === "stable"}
            query={queries[index]}
          />
        ))}
      </div>
    </div>
  )
}
