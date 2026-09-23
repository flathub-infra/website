"use client"

import { useListPipelinesApiPipelinesGet } from "src/codegen-pipeline"
import { Button } from "@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
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
}: {
  appId: string
  repo: RepoType
  title: string
}) {
  const query = useListPipelinesApiPipelinesGet(
    {
      app_id: appId,
      app_id_match: "exact",
      target_repo: repo,
      type: "build",
      limit: 10,
    },
    { query: { refetchInterval: 30000 } },
  )
  const builds = query.data?.data
  return (
    <div>
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
      {builds && <BuildGroup title={title} builds={builds} repo={repo} />}
      {builds && query.isRefetchError && (
        <p role="alert" className="text-destructive text-sm">
          Refresh failed for {repo}; showing cached builds.
        </p>
      )}
    </div>
  )
}

function StableHistory({ appId }: { appId: string }) {
  const query = useListPipelinesApiPipelinesGet(
    {
      app_id: appId,
      app_id_match: "exact",
      target_repo: "stable",
      type: "build",
      limit: 10,
    },
    { query: { refetchInterval: 30000 } },
  )
  const builds = query.data?.data
  return (
    <>
      {builds &&
        builds.some((build) => build.started_at && build.finished_at) && (
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
              <BuildTimeChart builds={builds} />
            </CardContent>
          </Card>
        )}
      {query.isPending ? (
        <Card>
          <CardContent className="py-8">Loading stable builds...</CardContent>
        </Card>
      ) : null}
      {query.isError && !builds ? (
        <Card>
          <CardContent className="py-8 text-destructive">
            Could not load stable builds.{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {builds && (
        <BuildGroup
          title="Latest Stable Builds"
          builds={builds}
          repo="stable"
        />
      )}
      {builds && query.isRefetchError && (
        <p role="alert" className="text-destructive text-sm">
          Refresh failed for stable; showing cached builds.
        </p>
      )}
    </>
  )
}

export default function AppBuildStatusClient({ appId }: { appId: string }) {
  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Link href="/builds">
        <Button variant="ghost" className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
      <BuildStatusBanner />
      <div className="flex items-center gap-4">
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="wrap-break-word text-4xl font-extrabold">{appId}</h1>
          <p className="mt-2 text-muted-foreground">Build status and history</p>
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
      <div className="space-y-8">
        <StableHistory appId={appId} />
        {repos
          .filter(({ key }) => key !== "stable")
          .map(({ key, label }) => (
            <RepoHistory key={key} appId={appId} repo={key} title={label} />
          ))}
      </div>
    </div>
  )
}
