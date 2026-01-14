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
import { formatDistanceStrict, formatDistanceToNow } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { cn } from "@/lib/utils"

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
      return <Clock className={cn(size, "text-blue-500 animate-pulse")} />
    case "committed":
      return <Package className={cn(size, "text-green-500")} />
    default:
      return null
  }
}

function getStatusColor(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "published":
    case "committed":
      return "default"
    case "running":
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
                <th className="px-4 py-3 text-left font-semibold">Created</th>
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
                    <div className="flex items-center gap-2">
                      {getStatusIcon(build.status)}
                      <Badge variant={getStatusColor(build.status)}>
                        {build.status}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {build.build_id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        asChild
                      >
                        <a
                          href={`https://hub.flathub.org/status/${build.build_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {build.build_id}
                        </a>
                      </Button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new UTCDate(build.created_at), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {build.started_at && build.finished_at ? (
                      <span className="flex items-center gap-1">
                        {formatDistanceStrict(
                          new UTCDate(build.started_at),
                          new UTCDate(build.finished_at),
                          { unit: "minute" },
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {build.repro_pipeline_id ? (
                      <Badge variant="secondary" className="gap-1">
                        <Repeat2 className="h-3 w-3" />
                        Reprocheck
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        No reprocheck
                      </span>
                    )}
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
