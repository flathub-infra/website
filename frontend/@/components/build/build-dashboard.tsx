import { BuildTable } from "./build-table"
import {
  useListPipelinesApiPipelinesGet,
  PipelineStatus,
  PipelineSummary,
} from "src/codegen-pipeline"
import { LoadingDashboard } from "./loading-dashboard"
import { BuildRepoFilter } from "./build-repo-filter"
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { UTCDate } from "@date-fns/utc"

type StatusGroup = "in-progress" | "awaiting-publishing" | "completed"

const STATUS_GROUPS: Record<StatusGroup, PipelineStatus[]> = {
  "in-progress": ["pending", "running", "publishing", "succeeded"],
  "awaiting-publishing": ["committed"],
  completed: ["published", "failed", "cancelled"],
}

const GROUP_LABELS: Record<StatusGroup, string> = {
  "in-progress": "In Progress",
  "awaiting-publishing": "Awaiting Publishing",
  completed: "Completed",
}

const GROUP_ICONS: Record<StatusGroup, React.ReactNode> = {
  "in-progress": <Activity className="h-5 w-5" />,
  "awaiting-publishing": <Clock className="h-5 w-5" />,
  completed: <CheckCircle2 className="h-5 w-5" />,
}

const GROUP_COLORS: Record<StatusGroup, string> = {
  "in-progress": "text-blue-600 dark:text-blue-400",
  "awaiting-publishing": "text-yellow-600 dark:text-yellow-400",
  completed: "text-green-600 dark:text-green-400",
}

export function BuildDashboard({ appId, repoFilter, setRepoFilter }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<StatusGroup>>(
    new Set(["in-progress", "awaiting-publishing"]),
  )

  const toggleGroup = (group: StatusGroup) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(group)) {
      newExpanded.delete(group)
    } else {
      newExpanded.add(group)
    }
    setExpandedGroups(newExpanded)
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center gap-3">
          <BuildRepoFilter
            selectedRepoStatus={repoFilter}
            setSelectedRepoStatus={setRepoFilter}
          />
        </div>
      </Card>

      <Builds
        appId={appId}
        repoFilter={repoFilter}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
      />
    </div>
  )
}

const Builds = ({ appId, repoFilter, expandedGroups, toggleGroup }) => {
  const query = useListPipelinesApiPipelinesGet({
    app_id: appId || undefined,
    target_repo: repoFilter === "all" ? undefined : repoFilter,
    limit: 200,
  })

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      query.refetch()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [query])

  // Group by status group - must be called before any conditional returns
  const groupedByStatusGroup = useMemo(() => {
    const groups = new Map<StatusGroup, PipelineSummary[]>()

    // Initialize all groups
    Object.keys(STATUS_GROUPS).forEach((group) => {
      groups.set(group as StatusGroup, [])
    })

    if (!query.data?.data) {
      return groups
    }

    const filteredPipelines = query.data.data.filter((summary) => {
      const hasValidBuild =
        summary.build_id != null && summary.status !== "superseded"
      return hasValidBuild
    })

    // Distribute pipelines to groups
    filteredPipelines.forEach((pipeline) => {
      for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
        if ((statuses as PipelineStatus[]).includes(pipeline.status)) {
          groups.get(group as StatusGroup)?.push(pipeline)
          break
        }
      }
    })

    // Sort within each group by created_at (newest first)
    groups.forEach((pipelines) => {
      pipelines.sort(
        (a, b) =>
          new UTCDate(b.created_at).getTime() -
          new UTCDate(a.created_at).getTime(),
      )
    })

    return groups
  }, [query.data, appId])

  if (query.isLoading) {
    return <LoadingDashboard />
  }

  if (query.isError || !query.data) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load builds</p>
      </div>
    )
  }

  const statusGroupOrder: StatusGroup[] = [
    "in-progress",
    "awaiting-publishing",
    "completed",
  ]

  return (
    <div className="space-y-6">
      {statusGroupOrder.map((group) => {
        const pipelines = groupedByStatusGroup.get(group) || []
        const isExpanded = expandedGroups.has(group)

        return (
          <div key={group} className="space-y-3">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg bg-card border"
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex items-center", GROUP_COLORS[group])}>
                  {GROUP_ICONS[group]}
                </div>
                <h3 className="text-lg font-semibold">{GROUP_LABELS[group]}</h3>
                {group !== "completed" && (
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {pipelines.length} build{pipelines.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {isExpanded && pipelines.length > 0 && (
              <BuildTable pipelines={pipelines} />
            )}

            {isExpanded && pipelines.length === 0 && (
              <div className="px-6 py-8 text-center rounded-lg bg-card border">
                <p className="text-muted-foreground">
                  No builds in this category
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
