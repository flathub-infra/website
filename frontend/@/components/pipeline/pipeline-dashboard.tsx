import { PipelineCard } from "./pipeline-card"
import { PipelineFilter } from "./pipeline-filter"
import { useListPipelinesApiPipelinesGet } from "src/codegen-pipeline"
import { LoadingDashboard } from "./loading-dashboard"

export function PipelineDashboard({ appId, statusFilter, setStatusFilter }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <PipelineFilter
          selectedStatus={statusFilter}
          setSelectedStatus={setStatusFilter}
        />
      </div>

      <Pipelines appId={appId} statusFilter={statusFilter} />
    </div>
  )
}

const Pipelines = ({ appId, statusFilter }) => {
  const query = useListPipelinesApiPipelinesGet({
    app_id: appId,
    status_filter: statusFilter === "all" ? undefined : statusFilter,
    limit: 51,
  })

  if (query.isLoading) {
    return <LoadingDashboard />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {query.data?.data?.map((summary) => (
        <PipelineCard key={summary.id} pipelineSummary={summary} />
      ))}
    </div>
  )
}
