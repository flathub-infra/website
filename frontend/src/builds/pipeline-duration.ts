import { UTCDate } from "@date-fns/utc"
import type { PipelineSummary } from "src/codegen-pipeline"

export function buildDuration(pipeline: PipelineSummary): string {
  if (!pipeline.started_at)
    return pipeline.status === "pending" ? "Pending" : "-"
  if (!pipeline.finished_at)
    return ["pending", "running", "succeeded", "publishing"].includes(
      pipeline.status,
    )
      ? "In progress"
      : "-"
  const seconds = Math.max(
    0,
    Math.floor(
      (new UTCDate(pipeline.finished_at).getTime() -
        new UTCDate(pipeline.started_at).getTime()) /
        1000,
    ),
  )
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
