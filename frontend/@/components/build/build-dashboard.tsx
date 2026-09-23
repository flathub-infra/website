import { useMemo, useState } from "react"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useListPipelinesApiPipelinesGet,
  type ListPipelinesApiPipelinesGetParams,
} from "src/codegen-pipeline"
import { BuildTable } from "./build-table"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineRepoWithAll } from "./build-repo-filter"
import type { PipelineStatusWithAll } from "./build-status-filter"

type StatusGroup = "in-progress" | "awaiting-publishing" | "completed"
const groups: StatusGroup[] = [
  "in-progress",
  "awaiting-publishing",
  "completed",
]
const labels: Record<StatusGroup, string> = {
  "in-progress": "In Progress",
  "awaiting-publishing": "Awaiting Publishing",
  completed: "Completed",
}
const icons: Record<StatusGroup, React.ReactNode> = {
  "in-progress": <Activity className="h-5 w-5" />,
  "awaiting-publishing": <Clock className="h-5 w-5" />,
  completed: <CheckCircle2 className="h-5 w-5" />,
}
const colors: Record<StatusGroup, string> = {
  "in-progress": "text-blue-600 dark:text-blue-400",
  "awaiting-publishing": "text-yellow-600 dark:text-yellow-400",
  completed: "text-green-600 dark:text-green-400",
}

interface DashboardFilters {
  appId?: string
  repoFilter: PipelineRepoWithAll
  statusFilter: PipelineStatusWithAll
  dateFrom?: string
  dateTo?: string
}

function DashboardGroup({
  group,
  filters,
}: {
  group: StatusGroup
  filters: DashboardFilters
}) {
  const [offset, setOffset] = useState(0)
  const [expanded, setExpanded] = useState(group !== "completed")
  const filterKey = useMemo(() => JSON.stringify(filters), [filters])
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey)
    setOffset(0)
  }
  const params: ListPipelinesApiPipelinesGetParams = {
    type: "build",
    group,
    limit: 50,
    offset,
    app_id: filters.appId,
    app_id_match: "contains",
    target_repo: filters.repoFilter === "all" ? undefined : filters.repoFilter,
    status: filters.statusFilter === "all" ? undefined : filters.statusFilter,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
  }
  const query = useListPipelinesApiPipelinesGet(params, {
    query: {
      refetchInterval: 30000,
      retry: false,
      placeholderData: keepPreviousData,
    },
  })
  const pipelines = query.data?.data
  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg bg-card border"
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center", colors[group])}>
            {icons[group]}
          </div>
          <h3 className="text-lg font-semibold">{labels[group]}</h3>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {pipelines?.length ?? 0}{" "}
            {pipelines?.length === 1 ? "record" : "records"} on this page
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {query.isError && (
        <div role="alert" className="px-6 py-3 text-destructive">
          {pipelines
            ? "Refresh failed; showing the last loaded page."
            : `Failed to load ${labels[group].toLowerCase()} builds.`}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {expanded && (
        <div>
          {query.isPending && <p className="px-6 py-8">Loading builds...</p>}
          {pipelines &&
            (pipelines.length ? (
              <BuildTable pipelines={pipelines} />
            ) : (
              <p className="px-6 py-8 text-center rounded-lg bg-card border">
                No builds in this category
              </p>
            ))}
          {pipelines && (
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {offset / 50 + 1}
              </span>
              <Button
                variant="outline"
                disabled={pipelines.length < 50}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BuildDashboard(filters: DashboardFilters) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <DashboardGroup key={group} group={group} filters={filters} />
      ))}
    </div>
  )
}
