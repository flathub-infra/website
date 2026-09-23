import { PipelineSummary } from "src/codegen-pipeline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "src/i18n/navigation"
import {
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  Package,
  ExternalLink,
  Repeat2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { cn } from "@/lib/utils"
import { getPipelineFailureUrl } from "src/builds/pipeline-links"
import { buildDuration } from "src/builds/pipeline-duration"

interface BuildGroupProps {
  title: string
  builds: PipelineSummary[]
  repo: "stable" | "beta" | "test"
}

function getStatusIcon(status: string, size = "h-4 w-4") {
  switch (status) {
    case "published":
      return <CheckCircle className={cn(size, "text-green-500")} />
    case "failed":
      return <XCircle className={cn(size, "text-red-500")} />
    case "cancelled":
      return <Ban className={cn(size, "text-gray-500")} />
    case "running":
    case "succeeded":
      return <Clock className={cn(size, "text-blue-500 animate-pulse")} />
    case "committed":
      return <Package className={cn(size, "text-green-500")} />
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

function getStatusColor(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "published":
    case "committed":
      return "default"
    case "running":
    case "succeeded":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

export function BuildGroup({ title, builds, repo }: BuildGroupProps) {
  const displayBuilds = builds.slice(0, 10)

  if (builds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          No {repo} builds found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {builds.length > 10 && (
            <span className="text-sm text-muted-foreground">
              Showing 10 of {builds.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Commit</th>
                <th className="px-4 py-3 text-left font-semibold">Started</th>
                <th className="px-4 py-3 text-left font-semibold">Duration</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Reproducibility
                </th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayBuilds.map((build) => (
                <tr
                  key={build.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    {(() => {
                      const target =
                        build.status === "failed"
                          ? getPipelineFailureUrl(build)
                          : build.status === "publishing" &&
                              build.update_repo_job_id != null
                            ? `https://hub.flathub.org/status/${build.update_repo_job_id}`
                            : ["committed", "succeeded"].includes(
                                  build.status,
                                ) && build.commit_job_id != null
                              ? `https://hub.flathub.org/status/${build.commit_job_id}`
                              : null
                      const badge = (
                        <>
                          <Badge variant={getStatusColor(build.status)}>
                            {getStatusLabel(build.status)}
                          </Badge>
                        </>
                      )
                      return (
                        <div className="flex items-center gap-2">
                          {getStatusIcon(build.status)}
                          {target ? (
                            <a href={target} target="_blank" rel="noreferrer">
                              {badge}
                            </a>
                          ) : (
                            badge
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {build.source_repo && (build.pr_number || build.sha) ? (
                      <a
                        href={`https://github.com/${build.source_repo}/${build.pr_number ? `pull/${build.pr_number}` : `commit/${build.sha}`}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {build.pr_number
                          ? `PR #${build.pr_number}`
                          : build.sha?.slice(0, 7)}
                      </a>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {build.started_at ? (
                      build.log_url ? (
                        <a
                          href={build.log_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {formatDistanceToNow(new UTCDate(build.started_at), {
                            addSuffix: true,
                          })}
                        </a>
                      ) : (
                        formatDistanceToNow(new UTCDate(build.started_at), {
                          addSuffix: true,
                        })
                      )
                    ) : build.status === "pending" ? (
                      "Pending"
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{buildDuration(build)}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col items-start gap-1">
                      {build.reprocheck_status_code === "42" &&
                      build.repro_pipeline_id &&
                      build.reprocheck_result_url ? (
                        <a
                          href={`https://builds.flathub.org/diffoscope/${build.repro_pipeline_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          Unreproducible
                        </a>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Repeat2 className="h-3 w-3" />
                          {build.reprocheck_status_code === "0"
                            ? "Reproducible"
                            : build.reprocheck_status_code === "42"
                              ? "Unreproducible"
                              : build.reprocheck_status_code === "1"
                                ? "Failed to rebuild"
                                : build.repro_pipeline_id
                                  ? "Unknown"
                                  : "No reprocheck"}
                        </Badge>
                      )}
                      {build.repro_pipeline_id && (
                        <Link
                          href={`/builds/${build.repro_pipeline_id}`}
                          className="text-xs underline"
                        >
                          Reprocheck details
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/builds/${build.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
