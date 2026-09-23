"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineStatus } from "src/codegen-pipeline"

export type PipelineStatusWithAll = PipelineStatus | "all"

export const statuses: PipelineStatusWithAll[] = [
  "all",
  "pending",
  "running",
  "succeeded",
  "committed",
  "publishing",
  "published",
  "failed",
  "cancelled",
  "superseded",
]

const statusLabels: Record<PipelineStatusWithAll, string> = {
  all: "All statuses",
  pending: "Pending",
  running: "Building",
  succeeded: "Committing",
  committed: "Committed",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
  superseded: "Superseded",
}

export function isPipelineStatusWithAll(
  value: string,
): value is PipelineStatusWithAll {
  return statuses.some((status) => status === value)
}

export function BuildStatusFilter({
  selectedStatus,
  setSelectedStatus,
  className,
}: {
  selectedStatus: PipelineStatusWithAll
  setSelectedStatus: (status: PipelineStatusWithAll) => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Status filter"
          className={cn("flex gap-2", className)}
        >
          <Filter className="h-4 w-4" />
          <span>Status Filter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedStatus}
          onValueChange={(value) => {
            if (isPipelineStatusWithAll(value)) setSelectedStatus(value)
          }}
        >
          {statuses.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {statusLabels[status]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
