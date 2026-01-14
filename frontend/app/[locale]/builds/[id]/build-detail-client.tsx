"use client"

import { Button } from "../../../../@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useGetPipelineApiPipelinesPipelineIdGet } from "../../../../src/codegen-pipeline"
import Spinner from "../../../../src/components/Spinner"
import {
  getRepoBadgeVariant,
  BuildCardContent,
} from "../../../../@/components/build/build-card"
import { Badge } from "../../../../@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../@/components/ui/card"
import {
  Repeat2,
  ExternalLink,
  DollarSign,
  FileJson,
  Activity,
  GitCommit,
  Rocket,
  FileCode,
  Link as LinkIcon,
} from "lucide-react"

interface Props {
  pipelineId: string
}

export default function BuildDetailClient({ pipelineId }: Props) {
  const query = useGetPipelineApiPipelinesPipelineIdGet(pipelineId)

  if (query.isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Spinner size="m" />
      </div>
    )
  }

  if (query.isError || !query.data?.data) {
    return (
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Link href="/builds">
          <Button variant="ghost" className="mb-6">
            <ArrowLeftIcon className="h-4 w-4 me-2" />
            Back to Dashboard
          </Button>
        </Link>
        <p className="text-red-500">
          Error loading build details: {query.error?.message || "Unknown error"}
        </p>
      </div>
    )
  }

  const pipeline = query.data.data
  const {
    app_id,
    repo,
    triggered_by,
    build_id,
    commit_job_id,
    publish_job_id,
    update_repo_job_id,
    repro_pipeline_id,
    log_url,
    params,
    total_cost,
    created_at,
    started_at,
    finished_at,
  } = pipeline

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/builds">
          <Button variant="ghost" className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Link href={`/builds/apps/${app_id}`}>
          <Button variant="outline" className="gap-2">
            <Activity className="h-4 w-4" />
            App Status
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <GitCommit className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-5xl font-extrabold">{app_id}</h1>
            <p className="text-lg text-muted-foreground mt-2">
              Build details and history
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {repo && (
              <Badge
                variant={getRepoBadgeVariant(repo)}
                className="text-sm font-bold px-3 py-1.5"
              >
                {repo.toUpperCase()}
              </Badge>
            )}
            <Badge variant="outline" className="gap-2 text-sm px-3 py-1.5">
              <Rocket className="h-3.5 w-3.5" />
              {triggered_by === "manual" ? "Manual" : "Webhook"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Build Progress Card */}
      <Card className="border-2">
        <CardHeader className="bg-muted/30 dark:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Build Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <BuildCardContent pipelineSummary={pipeline} />
        </CardContent>
      </Card>

      {/* Job Links */}
      <Card className="border-2">
        <CardHeader className="bg-muted/30 dark:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <LinkIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Related Jobs</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {log_url && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <a
                  href={log_url}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-3"
                >
                  <FileCode className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Build Logs</span>
                </a>
              </Button>
            )}
            {build_id && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <a
                  href={`https://hub.flathub.org/status/${build_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-3"
                >
                  <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Build Job</span>
                </a>
              </Button>
            )}
            {commit_job_id && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <a
                  href={`https://hub.flathub.org/status/${commit_job_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-3"
                >
                  <GitCommit className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Commit Job</span>
                </a>
              </Button>
            )}
            {publish_job_id && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <a
                  href={`https://hub.flathub.org/status/${publish_job_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-3"
                >
                  <Rocket className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Publish Job</span>
                </a>
              </Button>
            )}
            {update_repo_job_id && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <a
                  href={`https://hub.flathub.org/status/${update_repo_job_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-3"
                >
                  <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Update Repo Job</span>
                </a>
              </Button>
            )}
            {repro_pipeline_id && (
              <Button
                variant="outline"
                size="default"
                asChild
                className="w-full justify-start h-auto py-4 px-5 hover:bg-primary/5 transition-all group"
              >
                <Link href={`/builds/${repro_pipeline_id}`} className="gap-3">
                  <Repeat2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Reprocheck Pipeline</span>
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Build Parameters */}
      {params && (
        <Card className="border-2">
          <CardHeader className="bg-muted/30 dark:bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <FileJson className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Build Parameters
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-muted/50 rounded-xl border overflow-hidden">
              <pre className="p-6 text-sm overflow-auto max-h-80 font-mono">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Information */}
      {total_cost !== undefined && total_cost !== null && (
        <Card className="border-2">
          <CardHeader className="bg-muted/30 dark:bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Build Cost</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-6 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
              <p className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-300">
                ${total_cost.toFixed(4)}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                Total infrastructure cost for this build
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
