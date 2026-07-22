export type GitHubActionsRun = {
  owner: string
  repo: string
  runId: string
}

export type GitHubActionsStep = {
  name: string
  status: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
}

export type GitHubActionsJob = {
  id: number
  name: string
  html_url: string
  status: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
  steps?: GitHubActionsStep[]
}

type GitHubActionsJobsResponse = {
  total_count: number
  jobs: GitHubActionsJob[]
}

const GITHUB_JOBS_PER_PAGE = 100

export function getGitHubActionsRun(logUrl?: string | null) {
  if (!logUrl) {
    return null
  }

  try {
    const url = new URL(logUrl)
    const [owner, repo, actions, runs, runId] = url.pathname
      .split("/")
      .filter(Boolean)

    if (
      url.hostname !== "github.com" ||
      actions !== "actions" ||
      runs !== "runs"
    ) {
      return null
    }

    if (!owner || !repo || !runId) {
      return null
    }

    return { owner, repo, runId }
  } catch {
    return null
  }
}

export async function fetchGitHubActionsJobs(run: GitHubActionsRun) {
  const jobs: GitHubActionsJob[] = []
  let page = 1
  let totalCount: number | null = null

  do {
    const searchParams = new URLSearchParams({
      per_page: String(GITHUB_JOBS_PER_PAGE),
      page: String(page),
    })
    const response = await fetch(
      `https://api.github.com/repos/${run.owner}/${run.repo}/actions/runs/${run.runId}/jobs?${searchParams}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to load GitHub Actions jobs")
    }

    const data = (await response.json()) as GitHubActionsJobsResponse
    totalCount = data.total_count
    if (data.jobs.length === 0) {
      break
    }
    jobs.push(...data.jobs)
    page += 1
  } while (totalCount !== null && jobs.length < totalCount)

  return jobs
}
