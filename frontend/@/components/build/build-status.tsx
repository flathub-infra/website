import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Package,
  CircleDashed,
  AlertCircle,
  Ban,
  Loader2,
  Rocket,
  CheckCheck,
} from "lucide-react"
import { PipelineStatus, PipelineSummary } from "src/codegen-pipeline"
import { Badge } from "@/components/ui/badge"

interface BuildStatusProps {
  pipelineSummary: PipelineSummary
}

export function BuildStatus({ pipelineSummary }: BuildStatusProps) {
  const { status } = pipelineSummary

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0">
        <StatusIcon status={status} />
      </div>
      <div className="flex-1 space-y-2">
        <StatusBadge status={status} />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {getStatusDescription(status)}
        </p>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: PipelineStatus }) {
  const iconClass = "size-10"

  switch (status) {
    case "pending":
      return (
        <div className="p-2 rounded-full bg-muted">
          <CircleDashed className={cn(iconClass, "text-muted-foreground")} />
        </div>
      )
    case "running":
      return (
        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Loader2
            className={cn(
              iconClass,
              "text-blue-600 dark:text-blue-400 animate-spin",
            )}
          />
        </div>
      )
    case "succeeded":
      return (
        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCheck
            className={cn(iconClass, "text-green-600 dark:text-green-400")}
          />
        </div>
      )
    case "committed":
      return (
        <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Package
            className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")}
          />
        </div>
      )
    case "publishing":
      return (
        <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
          <Rocket
            className={cn(
              iconClass,
              "text-indigo-600 dark:text-indigo-400 animate-pulse",
            )}
          />
        </div>
      )
    case "published":
      return (
        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle
            className={cn(iconClass, "text-green-600 dark:text-green-400")}
          />
        </div>
      )
    case "failed":
      return (
        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
          <XCircle
            className={cn(iconClass, "text-red-600 dark:text-red-400")}
          />
        </div>
      )
    case "cancelled":
      return (
        <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-900/30">
          <Ban className={cn(iconClass, "text-gray-600 dark:text-gray-400")} />
        </div>
      )
    case "superseded":
      return (
        <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
          <AlertCircle
            className={cn(iconClass, "text-yellow-600 dark:text-yellow-400")}
          />
        </div>
      )
    default:
      return (
        <div className="p-2 rounded-full bg-muted">
          <CircleDashed className={cn(iconClass, "text-muted-foreground")} />
        </div>
      )
  }
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  const variant = getStatusVariant(status)
  const label = getStatusLabel(status)

  return (
    <Badge variant={variant} className="w-fit text-sm font-bold px-3 py-1">
      {label}
    </Badge>
  )
}

function getStatusVariant(
  status: PipelineStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "succeeded":
    case "published":
    case "committed":
      return "default"
    case "running":
    case "publishing":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

function getStatusLabel(status: PipelineStatus): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "running":
      return "Building"
    case "succeeded":
      return "Build Succeeded"
    case "committed":
      return "Committed"
    case "publishing":
      return "Publishing"
    case "published":
      return "Published"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    case "superseded":
      return "Superseded"
    default:
      return status
  }
}

function getStatusDescription(status: PipelineStatus): string {
  switch (status) {
    case "pending":
      return "Build is queued and waiting to start"
    case "running":
      return "Build is actively running on the build server"
    case "succeeded":
      return "Build completed successfully and is ready to publish"
    case "committed":
      return "Changes have been committed to the repository"
    case "publishing":
      return "Build artifacts are being published to Flathub"
    case "published":
      return "Successfully published and available on Flathub"
    case "failed":
      return "Build encountered errors and could not complete"
    case "cancelled":
      return "Build was manually cancelled before completion"
    case "superseded":
      return "This build was replaced by a newer version"
    default:
      return "Status information unavailable"
  }
}
