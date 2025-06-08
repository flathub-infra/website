"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter } from "lucide-react"

export type PipelineStatusWithAll =
  | "all"
  | "pending"
  | "running"
  | "failed"
  | "cancelled"
  | "published"
  | "succeeded"
  | "committed"
  | "publishing"
  | "superseded"

const statuses: PipelineStatusWithAll[] = [
  "all",
  "pending",
  "running",
  "failed",
  "cancelled",
  "published",
  "succeeded",
  "committed",
  "publishing",
  "superseded",
]

export function BuildStatusFilter({
  selectedStatus,
  setSelectedStatus,
}: {
  selectedStatus: PipelineStatusWithAll
  setSelectedStatus: (status: PipelineStatusWithAll) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          <Filter className="h-4 w-4" />
          <span>Status Filter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {statuses.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selectedStatus === status}
            onCheckedChange={() => setSelectedStatus(status)}
            className="capitalize"
          >
            {status}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
