import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Flag, PackageCheck, PlayCircle, PlusCircle } from "lucide-react"
import { formatDistance, formatDistanceToNow } from "date-fns"
import { PipelineSummary } from "src/codegen-pipeline"
import Link from "next/link"
import { BuildStatus as BuildStatus } from "./build-status"

interface PipelineCardProps {
  pipelineSummary: PipelineSummary
}

export function BuildCard({ pipelineSummary }: PipelineCardProps) {
  const { app_id, id, repo } = pipelineSummary

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start w-full truncate">
          <CardTitle className="text-lg truncate">{app_id}</CardTitle>
          {repo && <Badge variant={getRepoBadgeVariant(repo)}>{repo}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <BuildCardContent pipelineSummary={pipelineSummary} />
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/builds/${id}`} className="size-4 mr-2">
            View Details
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
    <>
      <BuildStatus pipelineSummary={pipelineSummary} />
      <div>
        {created_at && !started_at && !finished_at && (
          <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4 pb-9">
            <PlusCircle className="size-4 mr-1" />
            <span>Created {formatDistanceToNow(new Date(created_at))} ago</span>
          </div>
        )}
        {started_at && !finished_at && (
          <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4 pb-9">
            <PlayCircle className="size-4 mr-1" />
            <span>Started {formatDistanceToNow(new Date(started_at))} ago</span>
          </div>
        )}
        {started_at && finished_at && (
          <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
            <Clock className="size-4 mr-1" />
            <span>
              Build in{" "}
              {formatDistance(new Date(started_at), new Date(finished_at))}
            </span>
          </div>
        )}
        {finished_at && !published_at && (
          <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
            <Flag className="size-4 mr-1" />
            <span>
              Finished {formatDistanceToNow(new Date(finished_at))} ago
            </span>
          </div>
        )}
        {published_at && (
          <div className="flex items-center text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray mt-4">
            <PackageCheck className="size-4 mr-1" />
            <span>
              Published {formatDistanceToNow(new Date(published_at))} ago
            </span>
          </div>
        )}
      </div>
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
