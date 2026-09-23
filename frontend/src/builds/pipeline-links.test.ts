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

  it("prefers build_id over earlier, succeeded jobs", () => {
    expect(getPipelineFailureUrl({ ...links, failure_issue_url: null })).toBe(
      "https://hub.flathub.org/status/5",
    )
  })

  it("falls back through the job ids in pipeline order", () => {
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        build_id: null,
      }),
    ).toBe("https://hub.flathub.org/status/33")
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        build_id: null,
        commit_job_id: null,
      }),
    ).toBe("https://hub.flathub.org/status/22")
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        build_id: null,
        commit_job_id: null,
        publish_job_id: null,
      }),
    ).toBe("https://hub.flathub.org/status/11")
  })

  it("falls back to the workflow log, then null", () => {
    expect(
      getPipelineFailureUrl({
        ...links,
        failure_issue_url: null,
        build_id: null,
        commit_job_id: null,
        publish_job_id: null,
        update_repo_job_id: null,
      }),
    ).toBe(links.log_url)
    expect(
      getPipelineFailureUrl({
        failure_issue_url: null,
        build_id: null,
        commit_job_id: null,
        publish_job_id: null,
        update_repo_job_id: null,
        log_url: null,
      }),
    ).toBeNull()
  })
})
