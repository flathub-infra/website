import { useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { getLangDir } from "rtl-detect"
import { formatDistanceToNow } from "date-fns"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useListPipelinesApiPipelinesGet,
  type ListPipelinesApiPipelinesGetParams,
} from "src/codegen-pipeline"
import { BuildTable } from "./build-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Clock, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineRepoWithAll } from "./build-repo-filter"
import type { PipelineStatusWithAll } from "./build-status-filter"

const PAGE_SIZE = 50
type StatusGroup = "in-progress" | "awaiting-publishing" | "completed"
const groups: StatusGroup[] = [
  "in-progress",
  "awaiting-publishing",
  "completed",
]
const labels: Record<StatusGroup, string> = {
  "in-progress": "In progress",
  "awaiting-publishing": "Awaiting publish",
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
  const [displayOffset, setDisplayOffset] = useState(0)
  const filterKey = useMemo(() => JSON.stringify(filters), [filters])
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey)
    setOffset(0)
    setDisplayOffset(0)
  }
  const params: ListPipelinesApiPipelinesGetParams = {
    type: "build",
    group,
    limit: PAGE_SIZE,
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
  if (
    !query.isPlaceholderData &&
    pipelines &&
    offset > 0 &&
    pipelines.length === 0
  ) {
    setOffset(offset - PAGE_SIZE)
  }
  if (
    !query.isPlaceholderData &&
    pipelines &&
    pipelines.length > 0 &&
    displayOffset !== offset
  ) {
    setDisplayOffset(offset)
  }
  return (
    <section className="flex flex-col gap-4" aria-label={labels[group]}>
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center", colors[group])}>
            {icons[group]}
          </div>
          <h2 className="text-lg font-semibold">{labels[group]}</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {pipelines
              ? `${pipelines.length} ${pipelines.length === 1 ? "record" : "records"} on this page`
              : query.isPending
                ? "Loading…"
                : "—"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {query.isFetching
            ? "Refreshing…"
            : query.dataUpdatedAt > 0
              ? `Updated ${formatDistanceToNow(new Date(query.dataUpdatedAt), { addSuffix: true })}`
              : null}
        </span>
      </div>
      {query.isError && (
        <div role="alert" className="px-6 py-3 text-destructive">
          {pipelines
            ? "Refresh failed; showing the last loaded page."
            : `Could not load ${labels[group].toLowerCase()} builds.`}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <div>
        {query.isPending && <p className="px-6 py-8">Loading builds...</p>}
        {pipelines &&
          (pipelines.length ? (
            <BuildTable pipelines={pipelines} />
          ) : (
            <p className="px-6 py-8 text-center rounded-lg bg-card border">
              {offset > 0
                ? "No builds on this page"
                : "No builds in this category"}
            </p>
          ))}
        {pipelines && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button
              variant="outline"
              disabled={
                offset === 0 || query.isFetching || query.isPlaceholderData
              }
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {displayOffset / PAGE_SIZE + 1}
            </span>
            <Button
              variant="outline"
              disabled={
                pipelines.length < PAGE_SIZE ||
                query.isFetching ||
                query.isPlaceholderData
              }
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export function BuildDashboard(filters: DashboardFilters) {
  const locale = useLocale()
  const preferredGroup: StatusGroup =
    filters.statusFilter === "committed"
      ? filters.repoFilter === "test"
        ? "completed"
        : "awaiting-publishing"
      : ["published", "failed", "cancelled", "superseded"].includes(
            filters.statusFilter,
          )
        ? "completed"
        : "in-progress"
  const [activeGroup, setActiveGroup] = useState<StatusGroup>(preferredGroup)
  const filterSelection = `${filters.statusFilter}:${filters.repoFilter}`
  const [previousSelection, setPreviousSelection] = useState(filterSelection)
  if (previousSelection !== filterSelection) {
    setPreviousSelection(filterSelection)
    if (filters.statusFilter !== "all") setActiveGroup(preferredGroup)
  }

  return (
    <Tabs
      dir={getLangDir(locale)}
      value={activeGroup}
      onValueChange={(value) => setActiveGroup(value as StatusGroup)}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList
          className="h-auto flex-wrap justify-start"
          aria-label="Build queues"
        >
          {groups.map((group) => (
            <TabsTrigger key={group} value={group} className="gap-2 py-2">
              {labels[group]}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className="text-xs text-muted-foreground">
          Refreshes every 30 seconds
        </span>
      </div>
      {groups.map((group) => (
        <TabsContent
          key={group}
          value={group}
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <DashboardGroup group={group} filters={filters} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
