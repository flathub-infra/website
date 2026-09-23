"use client"

import { Button } from "../../../../@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useGetPipelineApiPipelinesPipelineIdGet } from "../../../../src/codegen-pipeline"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceStrict, formatDistanceToNow } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import Breadcrumbs from "src/components/Breadcrumbs"
import { buildDuration } from "src/builds/pipeline-duration"
import { BuildStatus } from "@/components/build/build-status"
import Spinner from "../../../../src/components/Spinner"
import { getRepoBadgeVariant } from "../../../../@/components/build/build-card"
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
  GitCommit,
  Rocket,
  Download,
  GitPullRequest,
  ListChecks,
} from "lucide-react"
import {
  fetchGitHubActionsJobs,
  getGitHubActionsRun,
  type GitHubActionsJob,
} from "src/builds/github-actions"
import { getPipelineFailureUrl } from "src/builds/pipeline-links"

type ReprocheckResult = {
  message?: string
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

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null
  }

  const reprocheckResult = result as Record<string, unknown>

  return {
    message:
      typeof reprocheckResult.message === "string"
        ? reprocheckResult.message
        : undefined,
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
  const failureUrl = getPipelineFailureUrl(pipeline)

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Breadcrumbs
        pages={[
          { name: "Builds", href: "/builds", current: false },
          { name: app_id, href: `/builds/apps/${app_id}`, current: false },
          {
            name: `Build ${build_id ?? pipelineId}`,
            href: `/builds/${pipelineId}`,
            current: true,
          },
        ]}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="wrap-break-word text-3xl font-bold">
              <Link href={`/builds/apps/${app_id}`} className="hover:underline">
                {app_id}
              </Link>
            </h1>
            <p className="mt-1 text-muted-foreground">
              Build {build_id ?? pipelineId}
            </p>
          </div>
          {((status === "failed" && failureUrl) || log_url) && (
            <Button asChild>
              <a
                href={status === "failed" && failureUrl ? failureUrl : log_url!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {status === "failed" && failureUrl
                  ? "View failed job"
                  : "Build logs"}
              </a>
            </Button>
          )}
        </div>
        <BuildStatus pipelineSummary={pipeline} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {repo && (
            <Badge variant={getRepoBadgeVariant(repo)}>
              {repo.toUpperCase()}
            </Badge>
          )}
          <span>{triggered_by === "manual" ? "Manual" : "Webhook"}</span>
          <span>Duration: {buildDuration(pipeline)}</span>
          {pipeline.started_at && (
            <span title={new UTCDate(pipeline.started_at).toISOString()}>
              Started{" "}
              {formatDistanceToNow(new UTCDate(pipeline.started_at), {
                addSuffix: true,
              })}
            </span>
          )}
          {pipeline.finished_at && (
            <span title={new UTCDate(pipeline.finished_at).toISOString()}>
              Finished{" "}
              {formatDistanceToNow(new UTCDate(pipeline.finished_at), {
                addSuffix: true,
              })}
            </span>
          )}
          {pipeline.published_at && (
            <span title={new UTCDate(pipeline.published_at).toISOString()}>
              Published{" "}
              {formatDistanceToNow(new UTCDate(pipeline.published_at), {
                addSuffix: true,
              })}
            </span>
          )}
          {total_cost !== undefined && total_cost !== null && (
            <span>Cost ${total_cost.toFixed(4)}</span>
          )}
        </div>
      </div>
      {reprocheckResult && (
        <Card
          className={
            ["1", "42"].includes(reprocheckResult.status_code ?? "")
              ? "border-2 border-red-200 bg-red-50/60 dark:border-red-900/70 dark:bg-red-950/20"
              : "border-2"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Repeat2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Reproducibility
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="text-lg font-semibold">
                {reprocheckResult.status_code === "0"
                  ? "Reproducible"
                  : reprocheckResult.status_code === "42"
                    ? "Unreproducible"
                    : reprocheckResult.status_code === "1"
                      ? "Failed to rebuild"
                      : "Unknown"}
                {reprocheckResult.message && `: ${reprocheckResult.message}`}
              </p>
              {reprocheckResult.status_code !== "0" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {reprocheckResult.status_code === "42"
                    ? "The rebuilt app differs from the published app. Review the diffoscope output to see which files changed."
                    : reprocheckResult.status_code === "1"
                      ? "The app could not be rebuilt. Check the workflow logs for the cause."
                      : "No conclusive reproducibility result is available."}
                </p>
              )}
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
              {reprocheckResult.status_code === "42" &&
                reprocheckResult.result_url && (
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
                )}
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
                    <div key={job.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
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

      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer px-4 py-3 font-semibold">
          Related jobs and logs
        </summary>
        <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm">
          {log_url &&
            status === "failed" &&
            failureUrl &&
            failureUrl !== log_url && (
              <a
                href={log_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Build logs
              </a>
            )}
          {commit_job_id != null && (
            <a
              href={`https://hub.flathub.org/status/${commit_job_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Commit job
            </a>
          )}
          {publish_job_id != null && (
            <a
              href={`https://hub.flathub.org/status/${publish_job_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Publish job
            </a>
          )}
          {update_repo_job_id != null && (
            <a
              href={`https://hub.flathub.org/status/${update_repo_job_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Update-repo job
            </a>
          )}
          {repro_pipeline_id && (
            <Link
              href={`/builds/${repro_pipeline_id}`}
              className="text-primary hover:underline"
            >
              Reprocheck pipeline
            </Link>
          )}
          {build_id != null && (
            <span className="text-muted-foreground">Build ID {build_id}</span>
          )}
        </div>
      </details>
      {params && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
            Build Parameters
          </summary>
          <div className="m-4 overflow-hidden rounded-xl border bg-muted/50">
            <pre className="max-h-80 overflow-auto p-6 font-mono text-sm">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  )
}
