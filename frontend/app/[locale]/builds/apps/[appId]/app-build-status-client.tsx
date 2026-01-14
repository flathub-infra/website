"use client"

import { useListPipelinesApiPipelinesGet } from "src/codegen-pipeline"
import Spinner from "src/components/Spinner"
import { Button } from "@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useMemo } from "react"
import { BuildGroup } from "@/components/build/build-group"
import { BuildTimeChart } from "@/components/build/build-time-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, BarChart3, Layers } from "lucide-react"
import { UTCDate } from "@date-fns/utc"

interface Props {
  appId: string
}

type RepoType = "stable" | "beta" | "test"

export default function AppBuildStatusClient({ appId }: Props) {
  const query = useListPipelinesApiPipelinesGet({
    app_id: appId,
    limit: 200,
  })

  const groupedBuilds = useMemo(() => {
    if (!query.data?.data) {
      return {
        stable: [],
        beta: [],
        test: [],
      }
    }

    const groups: Record<RepoType, typeof query.data.data> = {
      stable: [],
      beta: [],
      test: [],
    }

    query.data.data.forEach((build) => {
      if (build.status === "superseded") return

      const repo = (build.repo?.toLowerCase() || "test") as RepoType
      if (repo in groups) {
        groups[repo].push(build)
      }
    })

    // Sort each group by created_at (newest first)
    Object.keys(groups).forEach((key) => {
      groups[key as RepoType].sort(
        (a, b) =>
          new UTCDate(b.created_at).getTime() -
          new UTCDate(a.created_at).getTime(),
      )
    })

    return groups
  }, [query])

  if (query.isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Spinner size="m" />
      </div>
    )
  }

  if (query.isError || !query.data?.data) {
    return (
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-6 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Link href="/builds">
          <Button variant="ghost" className="mb-6">
            <ArrowLeftIcon className="h-4 w-4 me-2" />
            Back to Dashboard
          </Button>
        </Link>
        <p className="text-red-500">
          Error loading app status: {query.error?.message || "Unknown error"}
        </p>
      </div>
    )
  }

  const totalBuilds = query.data.data.length
  const publishedBuilds = query.data.data.filter(
    (b) => b.status === "published",
  ).length
  const failedBuilds = query.data.data.filter(
    (b) => b.status === "failed",
  ).length

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Link href="/builds">
        <Button variant="ghost" className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold">{appId}</h1>
            <p className="text-lg text-muted-foreground mt-2">
              Build status and history
            </p>
          </div>
        </div>
      </div>

      {/* Build Time Chart */}
      {query.data.data.length > 0 && (
        <Card className="border-2">
          <CardHeader className="bg-muted/30 dark:bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Build Duration Trend
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <BuildTimeChart builds={query.data.data} />
          </CardContent>
        </Card>
      )}

      {/* Build Groups */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold">Build History by Repository</h2>
        </div>
        <p className="text-muted-foreground ml-14">
          Recent builds organized by target repository
        </p>
      </div>

      <div className="space-y-8">
        {(
          [
            { key: "stable", label: "Latest Stable Builds" },
            { key: "beta", label: "Latest Beta Builds" },
            { key: "test", label: "Latest Test Builds" },
          ] as const
        ).map(({ key, label }) => (
          <BuildGroup
            key={key}
            title={label}
            builds={groupedBuilds[key]}
            repo={key}
          />
        ))}
      </div>
    </div>
  )
}
