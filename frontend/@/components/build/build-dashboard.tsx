import { BuildCard } from "./build-card"
import { BuildFilter } from "./build-filter"
import { useListPipelinesApiPipelinesGet } from "src/codegen-pipeline"
import { LoadingDashboard } from "./loading-dashboard"

export function BuildDashboard({ appId, statusFilter, setStatusFilter }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <BuildFilter
          selectedStatus={statusFilter}
          setSelectedStatus={setStatusFilter}
        />
      </div>

      <Builds appId={appId} statusFilter={statusFilter} />
    </div>
  )
}

const Builds = ({ appId, statusFilter }) => {
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
        <BuildCard key={summary.id} pipelineSummary={summary} />
      ))}
    </div>
  )
}
