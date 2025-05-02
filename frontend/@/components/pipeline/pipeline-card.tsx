import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { PipelineSummary } from "src/codegen-pipeline"
import Link from "next/link"
import { PipelineStatus } from "./pipeline-status"

interface PipelineCardProps {
  pipelineSummary: PipelineSummary
}

export function PipelineCard({ pipelineSummary }: PipelineCardProps) {
  const { app_id, id, repo } = pipelineSummary

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start w-full">
          <CardTitle className="text-lg truncate">{app_id}</CardTitle>
          {repo && <Badge variant={getRepoBadgeVariant(repo)}>{repo}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <PipelineCardContent pipelineSummary={pipelineSummary} />
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/pipelines/${id}`} className="size-4 mr-2">
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export const PipelineCardContent = ({ pipelineSummary }) => {
  const { published_at, created_at, started_at, finished_at } = pipelineSummary

  return (
    <>
      <PipelineStatus pipelineSummary={pipelineSummary} />
      {created_at && !started_at && (
        <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
          <Clock className="size-4 mr-1" />
          <span>Created {formatDistanceToNow(new Date(created_at))} ago</span>
        </div>
      )}
      {started_at && !finished_at && (
        <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
          <Clock className="size-4 mr-1" />
          <span>Started {formatDistanceToNow(new Date(started_at))} ago</span>
        </div>
      )}
      {finished_at && (
        <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
          <Clock className="size-4 mr-1" />
          <span>Finished {formatDistanceToNow(new Date(finished_at))} ago</span>
        </div>
      )}
      {published_at && (
        <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
          <Clock className="size-4 mr-1" />
          <span>
            Published {formatDistanceToNow(new Date(published_at))} ago
          </span>
        </div>
      )}
    </>
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
