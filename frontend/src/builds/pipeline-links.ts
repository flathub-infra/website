import type { PipelineSummary } from "src/codegen-pipeline"

export function getPipelineFailureUrl(
  pipeline: Pick<
    PipelineSummary,
    | "failure_issue_url"
    | "update_repo_job_id"
    | "publish_job_id"
    | "commit_job_id"
    | "log_url"
  >,
): string | null {
  if (pipeline.failure_issue_url) return pipeline.failure_issue_url
  for (const id of [
    pipeline.update_repo_job_id,
    pipeline.publish_job_id,
    pipeline.commit_job_id,
  ]) {
    if (id != null) return `https://hub.flathub.org/status/${id}`
  }
  return pipeline.log_url ?? null
}
