import { BuildCard } from "./build-card"
import { BuildStatusFilter } from "./build-status-filter"
import { useListPipelinesApiPipelinesGet } from "src/codegen-pipeline"
import { LoadingDashboard } from "./loading-dashboard"
import { BuildRepoFilter } from "./build-repo-filter"

export function BuildDashboard({
  appId,
  statusFilter,
  setStatusFilter,
  repoFilter,
  setRepoFilter,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <BuildStatusFilter
          selectedStatus={statusFilter}
          setSelectedStatus={setStatusFilter}
        />
        <BuildRepoFilter
          selectedRepoStatus={repoFilter}
          setSelectedRepoStatus={setRepoFilter}
        />
      </div>

      <Builds
        appId={appId}
        statusFilter={statusFilter}
        repoFilter={repoFilter}
      />
    </div>
  )
}

const Builds = ({ appId, statusFilter, repoFilter }) => {
  const query = useListPipelinesApiPipelinesGet({
    app_id: appId,
    status_filter: statusFilter === "all" ? undefined : statusFilter,
    target_repo: repoFilter === "all" ? undefined : repoFilter,
    limit: 51,
  })

  if (query.isLoading) {
    return <LoadingDashboard />
  }

  const filteredPipelines =
    query.data?.data?.filter((summary) => {
      return !summary.params?.reprocheck_result
    }) || []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredPipelines.map((summary) => (
        <PipelineCard key={summary.id} pipelineSummary={summary} />
      ))}
    </div>
  )
}
