import { describe, expect, it } from "vitest"
import { getPipelineFailureUrl } from "./pipeline-links"

const links = {
  failure_issue_url: "https://github.com/issues/1",
  build_id: 5,
  commit_job_id: 33,
  publish_job_id: 22,
  update_repo_job_id: 11,
  log_url: "https://github.com/workflow/1",
}

describe("getPipelineFailureUrl", () => {
  it("prefers the failure issue over all jobs", () => {
    expect(getPipelineFailureUrl(links)).toBe(links.failure_issue_url)
  })

  it("falls back through update-repo, publish, then commit jobs", () => {
    expect(getPipelineFailureUrl({ ...links, failure_issue_url: null })).toBe(
      "https://hub.flathub.org/status/11",
    )
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        update_repo_job_id: null,
      }),
    ).toBe("https://hub.flathub.org/status/22")
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        update_repo_job_id: null,
        publish_job_id: null,
      }),
    ).toBe("https://hub.flathub.org/status/33")
  })

  it("uses workflow logs even when a build ID exists, then null", () => {
    const noJobs = {
      ...links,
      failure_issue_url: null,
      update_repo_job_id: null,
      publish_job_id: null,
      commit_job_id: null,
    }
    expect(getPipelineFailureUrl(noJobs)).toBe(links.log_url)
    expect(getPipelineFailureUrl({ ...noJobs, log_url: null })).toBeNull()
  })
})
