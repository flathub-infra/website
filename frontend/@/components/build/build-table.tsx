import { PipelineSummary } from "src/codegen-pipeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "src/i18n/navigation"
import {
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  Ban,
  Package,
  ArrowRight,
  GitCommit,
  GitPullRequest,
} from "lucide-react"
import { formatDistanceStrict, formatDistanceToNow } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { getRepoBadgeVariant } from "./build-card"
import { cn } from "@/lib/utils"
import { useGetPipelineApiPipelinesPipelineIdGet } from "src/codegen-pipeline"

interface BuildTableProps {
  pipelines: PipelineSummary[]
}

function getStatusIcon(status: string) {
  const iconClass = "h-4 w-4"
  switch (status) {
    case "published":
      return <CheckCircle className={cn(iconClass, "text-green-500")} />
    case "failed":
      return <XCircle className={cn(iconClass, "text-red-500")} />
    case "cancelled":
      return <Ban className={cn(iconClass, "text-gray-500")} />
    case "running":
      return <Clock className={cn(iconClass, "text-blue-500 animate-pulse")} />
    case "committed":
      return <Package className={cn(iconClass, "text-green-500")} />
    case "pending":
      return <Clock className={cn(iconClass, "text-gray-400")} />
    case "succeeded":
      return <CheckCircle className={cn(iconClass, "text-green-400")} />
    default:
      return null
  }
}

function getStatusLabel(status: string): string {
  if (status === "succeeded") {
    return "committing"
  }
  return status
}

function getStatusColor(status: string): string {
  switch (status) {
    case "published":
    case "committed":
    case "succeeded":
      return "bg-green-50 dark:bg-green-950/40"
    case "failed":
      return "bg-red-50 dark:bg-red-950/40"
    case "running":
    case "publishing":
      return "bg-blue-50 dark:bg-blue-950/40"
    case "cancelled":
      return "bg-gray-50 dark:bg-gray-950/40"
    default:
      return ""
  }
}

function BuildRow({ pipeline }: { pipeline: PipelineSummary }) {
  const detailQuery = useGetPipelineApiPipelinesPipelineIdGet(pipeline.id, {
    query: { staleTime: Infinity },
  })

  const params = detailQuery.data?.data?.params as
    | {
        repo?: string
        sha?: string
        pr_number?: string
      }
    | undefined

  const getSourceInfo = () => {
    if (!params) return null

    const { repo, sha, pr_number } = params

    // Parse repo string like "flathub/org.archivekeep.ArchiveKeep"
    const repoParts = repo?.split("/")
    if (!repoParts || repoParts.length !== 2) return null

    const [repo_owner, repo_name] = repoParts

    if (pr_number) {
      const prUrl = `https://github.com/${repo_owner}/${repo_name}/pull/${pr_number}`
      return {
        type: "pr" as const,
        label: `PR #${pr_number}`,
        url: prUrl,
      }
    }

    if (sha) {
      const commitUrl = `https://github.com/${repo_owner}/${repo_name}/commit/${sha}`
      const shortCommit = sha.substring(0, 7)
      return {
        type: "commit" as const,
        label: shortCommit,
        url: commitUrl,
      }
    }

    return null
  }

  const sourceInfo = getSourceInfo()

  return (
    <>
      {/* Desktop view */}
      <tr
        className={cn("hidden md:table-row", getStatusColor(pipeline.status))}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {getStatusIcon(pipeline.status)}
            </div>
            <span className="capitalize text-sm font-semibold">
              {getStatusLabel(pipeline.status)}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 font-medium max-w-xs">
          <Link
            href={`/builds/apps/${pipeline.app_id}`}
            className="hover:text-primary transition-colors flex items-center gap-2 group"
          >
            <span className="truncate group-hover:underline">
              {pipeline.app_id}
            </span>
          </Link>
        </td>
        <td className="px-6 py-4">
          {pipeline.repo ? (
            <Badge
              variant={getRepoBadgeVariant(pipeline.repo)}
              className="font-semibold"
            >
              {pipeline.repo.toUpperCase()}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </td>
        <td className="px-6 py-4 text-sm">
          {sourceInfo ? (
            <a
              href={sourceInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary transition-colors group"
            >
              {sourceInfo.type === "pr" ? (
                <GitPullRequest className="h-4 w-4 text-blue-500 group-hover:text-primary transition-colors" />
              ) : (
                <GitCommit className="h-4 w-4 text-blue-500 group-hover:text-primary transition-colors" />
              )}
              <span className="font-mono font-medium group-hover:underline">
                {sourceInfo.label}
              </span>
              <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">
              {detailQuery.isFetching ? "Loading..." : "-"}
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-muted-foreground">
          {formatDistanceToNow(new UTCDate(pipeline.created_at), {
            addSuffix: true,
          })}
        </td>
        <td className="px-6 py-4 text-sm font-medium">
          {pipeline.started_at && pipeline.finished_at ? (
            <span className="text-foreground">
              {formatDistanceStrict(
                new UTCDate(pipeline.started_at),
                new UTCDate(pipeline.finished_at),
                { unit: "minute" },
              )}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Pending</span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          <Button
            variant="ghost"
            size="sm"
            className="group hover:bg-primary/10"
            asChild
          >
            <Link
              href={`/builds/${pipeline.id}`}
              className="flex items-center gap-2"
            >
              <span className="text-xs font-medium">Details</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </td>
      </tr>

      {/* Mobile view */}
      <tr
        className={cn(
          "md:hidden border rounded-lg",
          getStatusColor(pipeline.status),
        )}
      >
        <td className="px-4 py-4 col-span-1 w-full">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(pipeline.status)}
                <span className="capitalize text-sm font-semibold text-foreground">
                  {getStatusLabel(pipeline.status)}
                </span>
              </div>
              {pipeline.repo && (
                <Badge
                  variant={getRepoBadgeVariant(pipeline.repo)}
                  className="font-semibold text-xs"
                >
                  {pipeline.repo.toUpperCase()}
                </Badge>
              )}
            </div>

            <Link
              href={`/builds/apps/${pipeline.app_id}`}
              className="hover:text-primary transition-colors block text-sm font-medium truncate hover:underline text-foreground"
            >
              {pipeline.app_id}
            </Link>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatDistanceToNow(new UTCDate(pipeline.created_at), {
                  addSuffix: true,
                })}
              </span>
              {pipeline.started_at && pipeline.finished_at && (
                <span>
                  {formatDistanceStrict(
                    new UTCDate(pipeline.started_at),
                    new UTCDate(pipeline.finished_at),
                    { unit: "minute" },
                  )}
                </span>
              )}
            </div>

            {sourceInfo && (
              <a
                href={sourceInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors group text-sm text-foreground"
              >
                {sourceInfo.type === "pr" ? (
                  <GitPullRequest className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                ) : (
                  <GitCommit className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                )}
                <span className="font-mono font-medium group-hover:underline">
                  {sourceInfo.label}
                </span>
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start group hover:bg-primary/10 h-8"
              asChild
            >
              <Link
                href={`/builds/${pipeline.id}`}
                className="flex items-center gap-2"
              >
                <span className="text-xs font-medium">Details</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </td>
      </tr>
    </>
  )
}

export function BuildTable({ pipelines }: BuildTableProps) {
  if (pipelines.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-lg font-medium text-muted-foreground">
          No builds found
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Adjust your filters or check back later
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden border rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-muted to-muted/60 border-b-2">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  App ID
                </th>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  Repo
                </th>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-4 text-right font-bold text-xs uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pipelines.map((pipeline) => (
                <BuildRow key={pipeline.id} pipeline={pipeline} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        <table className="w-full">
          <tbody className="space-y-3 flex flex-col">
            {pipelines.map((pipeline) => (
              <BuildRow key={pipeline.id} pipeline={pipeline} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
