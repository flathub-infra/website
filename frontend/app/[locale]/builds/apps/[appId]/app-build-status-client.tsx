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
import { getLangDir } from "rtl-detect"
import { getIntlLocale } from "src/localize"
import { toDurationSeries } from "src/builds/pipeline-history"
import { Button } from "@/components/ui/button"
import { BuildGroup } from "@/components/build/build-group"
import { BuildTimeChart } from "@/components/build/build-time-chart"
import { BuildStatusBanner } from "@/components/build/build-status-banner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  BuildNavigation,
  BuildPageHeader,
} from "@/components/build/build-page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type RepoType = "stable" | "beta" | "test"
const repos: { key: RepoType; label: string }[] = [
  { key: "stable", label: "Latest Stable Builds" },
  { key: "beta", label: "Latest Beta Builds" },
  { key: "test", label: "Latest Test Builds" },
]

function RepoHistory({
  repo,
  title,
  withChart,
  query,
}: {
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
        <Card>
          <CardHeader>
            <CardTitle>Build duration</CardTitle>
            <CardDescription>
              Recent {repo} builds · duration over time
            </CardDescription>
          </CardHeader>
          <CardContent>
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
  const locale = useLocale()
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
    <div className="build-page">
      <BuildNavigation
        pages={[
          { name: "Builds", href: "/builds", current: false },
          { name: appId, href: `/builds/apps/${appId}`, current: true },
        ]}
      />
      <BuildPageHeader
        title={appId}
        technical
        description="Build results, duration trends, and reproducibility across repositories."
      />
      <BuildStatusBanner />
      <Tabs
        dir={getLangDir(locale)}
        defaultValue="stable"
        className="flex min-w-0 flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="w-fit" aria-label="Build repository">
            {repos.map(({ key }) => (
              <TabsTrigger key={key} value={key}>
                {key === "stable" ? "Stable" : key === "beta" ? "Beta" : "Test"}
              </TabsTrigger>
            ))}
          </TabsList>
          {queries.some((query) => query.dataUpdatedAt > 0) && (
            <p className="text-xs text-muted-foreground">
              {queries.some((query) => query.isFetching)
                ? "Refreshing…"
                : `Updated ${formatDistanceToNow(new UTCDate(Math.max(...queries.map((query) => query.dataUpdatedAt))), { addSuffix: true })}`}
            </p>
          )}
        </div>
        {repos.map(({ key, label }, index) => (
          <TabsContent
            key={key}
            value={key}
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <RepoHistory
              repo={key}
              title={label}
              withChart={key === "stable"}
              query={queries[index]}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
