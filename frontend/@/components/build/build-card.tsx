import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Clock,
  PlayCircle,
  PlusCircle,
  Repeat2,
  ExternalLink,
  ArrowRight,
} from "lucide-react"
import { formatDistanceStrict, formatDistanceToNow } from "date-fns"
import { PipelineSummary } from "src/codegen-pipeline"
import { BuildStatus as BuildStatus } from "./build-status"
import { UTCDate } from "@date-fns/utc"
import { Link } from "src/i18n/navigation"
import { cn } from "@/lib/utils"

interface PipelineCardProps {
  pipelineSummary: PipelineSummary
}

export function BuildCard({ pipelineSummary }: PipelineCardProps) {
  const { app_id, id, repo, type, status } = pipelineSummary

  const isActive =
    status === "running" || status === "pending" || status === "publishing"
  const isSuccess =
    status === "published" || status === "committed" || status === "succeeded"
  const isFailure = status === "failed" || status === "cancelled"

  return (
    <Card
      className={cn(
        "group transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        "border-l-4 bg-card",
        isActive && "border-l-blue-500 bg-blue-50/80 dark:bg-slate-900/50",
        isSuccess && "border-l-green-500 bg-green-50/80 dark:bg-slate-900/50",
        isFailure && "border-l-red-500 bg-red-50/80 dark:bg-slate-900/50",
      )}
    >
      <CardHeader className="pb-3 space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <Link href={`/builds/apps/${app_id}`} className="block">
              <CardTitle className="text-xl truncate group-hover:text-primary transition-colors">
                {app_id}
              </CardTitle>
            </Link>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new UTCDate(pipelineSummary.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
            {repo && (
              <Badge
                variant={getRepoBadgeVariant(repo)}
                className="text-xs font-semibold"
              >
                {repo.toUpperCase()}
              </Badge>
            )}
            {type === "reprocheck" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Repeat2 className="h-3 w-3" />
                Reprocheck
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <BuildCardContent pipelineSummary={pipelineSummary} />
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 group" asChild>
          <Link href={`/builds/${id}`}>
            View Details
            <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/builds/apps/${app_id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export const BuildCardContent = ({
  pipelineSummary,
}: {
  pipelineSummary: PipelineSummary
}) => {
  const { published_at, created_at, started_at, finished_at } = pipelineSummary

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-3 border">
        <BuildStatus pipelineSummary={pipelineSummary} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {started_at && finished_at && (
          <div className="bg-muted/50 p-3 rounded-lg border">
            <p className="font-medium text-foreground text-xs mb-1">Duration</p>
            <p className="text-sm font-semibold">
              {formatDistanceStrict(started_at, finished_at, {
                unit: "minute",
              })}
            </p>
          </div>
        )}
        {finished_at && !published_at && (
          <div className="bg-muted/50 p-3 rounded-lg border">
            <p className="font-medium text-foreground text-xs mb-1">
              Completed
            </p>
            <p className="text-sm font-semibold">
              {formatDistanceToNow(new UTCDate(finished_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        )}
        {published_at && (
          <div className="bg-muted/50 p-3 rounded-lg border">
            <p className="font-medium text-foreground text-xs mb-1">
              Published
            </p>
            <p className="text-sm font-semibold">
              {formatDistanceToNow(new UTCDate(published_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {created_at && !started_at && !finished_at && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <PlusCircle className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-xs">Queued</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new UTCDate(created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        )}
        {started_at && !finished_at && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <PlayCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-xs">Building</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new UTCDate(started_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function getRepoBadgeVariant(
  repo: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (repo.toLowerCase()) {
    case "stable":
      return "default"
    case "beta":
      return "secondary"
    default:
      return "outline"
  }
}
