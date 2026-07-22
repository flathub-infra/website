"use client"

import { Button } from "../../../../@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useGetPipelineApiPipelinesPipelineIdGet } from "../../../../src/codegen-pipeline"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceStrict } from "date-fns"
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
  AlertTriangle,
  Download,
  GitPullRequest,
  ListChecks,
} from "lucide-react"
import {
  fetchGitHubActionsJobs,
  getGitHubActionsRun,
  type GitHubActionsJob,
} from "src/builds/github-actions"

type ReprocheckResult = {
  message: string
  status_code?: string
  timestamp?: string
  result_url?: string
}

const PROBLEM_JOB_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
])

function getReprocheckResult(
  params: Record<string, unknown>,
): ReprocheckResult | null {
  const result = params.reprocheck_result

  if (!result || typeof result !== "object") {
    return null
  }

  const reprocheckResult = result as Record<string, unknown>

  if (typeof reprocheckResult.message !== "string") {
    return null
  }

  return {
    message: reprocheckResult.message,
    status_code:
      typeof reprocheckResult.status_code === "string"
        ? reprocheckResult.status_code
        : undefined,
    timestamp:
      typeof reprocheckResult.timestamp === "string"
        ? reprocheckResult.timestamp
        : undefined,
    result_url:
      typeof reprocheckResult.result_url === "string"
        ? reprocheckResult.result_url
        : undefined,
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return null
  }

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }

  return formatDistanceStrict(startDate, endDate)
}

function getStringParam(params: Record<string, unknown>, key: string) {
  const value = params[key]
  return typeof value === "string" ? value : null
}

async function fetchBuildJobs(logUrl: string): Promise<GitHubActionsJob[]> {
  const run = getGitHubActionsRun(logUrl)

  if (!run) {
    throw new Error("Invalid GitHub Actions URL")
  }

  return fetchGitHubActionsJobs(run)
}

function getProblemJobs(jobs: GitHubActionsJob[]) {
  return jobs
    .filter((job) =>
      job.conclusion ? PROBLEM_JOB_CONCLUSIONS.has(job.conclusion) : false,
    )
    .sort((a, b) => {
      if (a.conclusion === "failure" && b.conclusion !== "failure") {
        return -1
      }

      if (a.conclusion !== "failure" && b.conclusion === "failure") {
        return 1
      }

      return a.name.localeCompare(b.name)
    })
}

function getProblemStep(job: GitHubActionsJob) {
  return job.steps?.find((step) =>
    step.conclusion ? PROBLEM_JOB_CONCLUSIONS.has(step.conclusion) : false,
  )
}

interface Props {
  pipelineId: string
}

export default function BuildDetailClient({ pipelineId }: Props) {
  const query = useGetPipelineApiPipelinesPipelineIdGet(pipelineId)
  const pipeline = query.data?.data
  const params = pipeline?.params ?? {}
  const reprocheckResult = pipeline ? getReprocheckResult(params) : null
  const shouldFetchGitHubJobs = Boolean(
    pipeline &&
    (pipeline.status === "failed" || pipeline.status === "cancelled") &&
    !reprocheckResult &&
    pipeline.log_url,
  )
  const githubJobsQuery = useQuery({
    queryKey: ["build-jobs", pipeline?.log_url],
    queryFn: () => {
      if (!pipeline?.log_url) {
        throw new Error("Missing build log URL")
      }

      return fetchBuildJobs(pipeline.log_url)
    },
    enabled: shouldFetchGitHubJobs,
    staleTime: 5 * 60 * 1000,
  })

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

  const {
    app_id,
    status,
    repo,
    triggered_by,
    build_id,
    commit_job_id,
    publish_job_id,
    update_repo_job_id,
    repro_pipeline_id,
    log_url,
    total_cost,
  } = pipeline
  const buildPipelineId =
    typeof params.build_pipeline_id === "string"
      ? params.build_pipeline_id
      : null
  const sourceRepo = getStringParam(params, "repo")
  const prNumber = getStringParam(params, "pr_number")
  const sha = getStringParam(params, "sha")
  const targetBranch = getStringParam(params, "pr_target_branch")
  const action = getStringParam(params, "action")
  const buildType = getStringParam(params, "build_type")
  const sourceRepoParts = sourceRepo?.split("/")
  const sourceRepoUrl =
    sourceRepoParts?.length === 2
      ? `https://github.com/${sourceRepoParts[0]}/${sourceRepoParts[1]}`
      : null
  const prUrl =
    sourceRepoUrl && prNumber ? `${sourceRepoUrl}/pull/${prNumber}` : null
  const commitUrl =
    sourceRepoUrl && sha ? `${sourceRepoUrl}/commit/${sha}` : null
  const problemJobs = githubJobsQuery.data
    ? getProblemJobs(githubJobsQuery.data)
    : []
  const primaryProblemJob = problemJobs[0]
  const primaryProblemStep = primaryProblemJob
    ? getProblemStep(primaryProblemJob)
    : null

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-fit rounded-xl bg-primary/10 p-3 sm:w-auto">
            <GitCommit className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="wrap-break-word text-4xl leading-tight font-extrabold sm:text-5xl">
              {app_id}
            </h1>
            <p className="mt-2 text-base text-muted-foreground sm:text-lg">
              Build details and history
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
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

      {status === "failed" && reprocheckResult && (
        <Card className="border-2 border-red-200 bg-red-50/60 dark:border-red-900/70 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-200 p-2 dark:bg-red-900/50">
                <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Reprocheck Failure
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="text-lg font-semibold text-red-900 dark:text-red-100">
                Reprocheck failed: {reprocheckResult.message}
              </p>
              <p className="mt-2 text-sm text-red-800/80 dark:text-red-200/80">
                The rebuilt app differs from the published app. Review the
                diffoscope output to see which files changed.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {reprocheckResult.status_code && (
                <div className="rounded-lg border border-red-200 bg-background/80 p-4 dark:border-red-900/70">
                  <p className="text-xs font-medium text-muted-foreground">
                    Status code
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {reprocheckResult.status_code}
                  </p>
                </div>
              )}
              {reprocheckResult.timestamp && (
                <div className="rounded-lg border border-red-200 bg-background/80 p-4 dark:border-red-900/70">
                  <p className="text-xs font-medium text-muted-foreground">
                    Checked at
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatTimestamp(reprocheckResult.timestamp)}
                  </p>
                </div>
              )}
              {buildPipelineId && (
                <div className="rounded-lg border border-red-200 bg-background/80 p-4 dark:border-red-900/70">
                  <p className="text-xs font-medium text-muted-foreground">
                    Original build
                  </p>
                  <Link
                    href={`/builds/${buildPipelineId}`}
                    className="mt-1 block truncate text-sm font-semibold text-primary hover:underline"
                  >
                    {buildPipelineId}
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" asChild>
                <a
                  href={`https://builds.flathub.org/diffoscope/${pipelineId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Diffoscope
                </a>
              </Button>
              {reprocheckResult.result_url && (
                <Button variant="outline" asChild>
                  <a
                    href={reprocheckResult.result_url}
                    target="_blank"
                    rel="noreferrer"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Result
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {shouldFetchGitHubJobs && (
        <Card className="border-2 border-red-200 bg-red-50/60 dark:border-red-900/70 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-200 p-2 dark:bg-red-900/50">
                <ListChecks className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <CardTitle className="text-2xl font-bold">
                GitHub Actions Failure
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {githubJobsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading GitHub Actions job details...
              </p>
            )}

            {githubJobsQuery.isError && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Could not load GitHub Actions job details.
                </p>
                <p className="text-sm text-red-800/80 dark:text-red-200/80">
                  Open the build logs to inspect the failed workflow run.
                </p>
              </div>
            )}

            {githubJobsQuery.isSuccess && problemJobs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No failed jobs were reported by GitHub Actions. Open the build
                logs for the full workflow details.
              </p>
            )}

            {primaryProblemJob && (
              <div className="space-y-2">
                <p className="text-base leading-snug font-semibold text-red-900 sm:text-lg dark:text-red-100">
                  {primaryProblemJob.conclusion === "failure"
                    ? "Build failed"
                    : "Build stopped"}{" "}
                  in {primaryProblemJob.name}
                  {primaryProblemStep
                    ? ` during ${primaryProblemStep.name}`
                    : ""}
                </p>
                <p className="text-sm leading-relaxed text-red-800/80 dark:text-red-200/80">
                  GitHub Actions reports the failed job and step, but not the
                  final log lines. Open the failed job for the detailed build
                  output.
                </p>
              </div>
            )}

            {problemJobs.length > 0 && (
              <div className="space-y-3">
                {problemJobs.map((job) => {
                  const problemStep = getProblemStep(job)
                  const jobDuration = formatDuration(
                    job.started_at,
                    job.completed_at,
                  )
                  const stepDuration = formatDuration(
                    problemStep?.started_at,
                    problemStep?.completed_at,
                  )

                  return (
                    <div
                      key={job.id}
                      className="rounded-xl border border-red-200 bg-background/80 p-4 dark:border-red-900/70"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-baseline gap-3">
                            <p className="leading-none font-semibold">
                              {job.name}
                            </p>
                            <Badge
                              variant={
                                job.conclusion === "failure"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="-translate-y-px"
                            >
                              {job.conclusion}
                            </Badge>
                          </div>
                          {problemStep && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Failed step: {problemStep.name}
                              {stepDuration ? ` (${stepDuration})` : ""}
                            </p>
                          )}
                          {jobDuration && (
                            <p className="text-xs text-muted-foreground">
                              Job duration: {jobDuration}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full sm:w-auto"
                        >
                          <a
                            href={job.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Job
                          </a>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(sourceRepo ||
        prNumber ||
        sha ||
        targetBranch ||
        action ||
        buildType) && (
        <Card className="border-2">
          <CardHeader className="bg-muted/30 dark:bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                <GitPullRequest className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Build Source</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              {sourceRepo && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Repository
                  </p>
                  {sourceRepoUrl ? (
                    <a
                      href={sourceRepoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-semibold text-primary hover:underline"
                    >
                      {sourceRepo}
                    </a>
                  ) : (
                    <p className="mt-1 truncate text-sm font-semibold">
                      {sourceRepo}
                    </p>
                  )}
                </div>
              )}
              {prNumber && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pull request
                  </p>
                  {prUrl ? (
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-sm font-semibold text-primary hover:underline"
                    >
                      PR #{prNumber}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold">#{prNumber}</p>
                  )}
                </div>
              )}
              {sha && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Commit
                  </p>
                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {sha.slice(0, 12)}
                    </a>
                  ) : (
                    <p className="mt-1 font-mono text-sm font-semibold">
                      {sha.slice(0, 12)}
                    </p>
                  )}
                </div>
              )}
              {targetBranch && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Target branch
                  </p>
                  <p className="mt-1 text-sm font-semibold">{targetBranch}</p>
                </div>
              )}
              {buildType && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Build type
                  </p>
                  <p className="mt-1 text-sm font-semibold">{buildType}</p>
                </div>
              )}
              {action && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Trigger action
                  </p>
                  <p className="mt-1 text-sm font-semibold">{action}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                Show raw pipeline parameters
              </summary>
              <div className="mt-4 overflow-hidden rounded-xl border bg-muted/50">
                <pre className="max-h-80 overflow-auto p-6 font-mono text-sm">
                  {JSON.stringify(params, null, 2)}
                </pre>
              </div>
            </details>
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
