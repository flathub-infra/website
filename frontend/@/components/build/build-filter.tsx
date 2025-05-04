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

export type PipelineStatus =
  | "all"
  | "pending"
  | "running"
  | "failed"
  | "cancelled"
  | "published"
  | "succeeded"
  | "superseded"

const statuses: PipelineStatus[] = [
  "all",
  "pending",
  "running",
  "failed",
  "cancelled",
  "published",
  "succeeded",
  "superseded",
]

export function BuildFilter({
  selectedStatus,
  setSelectedStatus,
}: {
  selectedStatus: PipelineStatus
  setSelectedStatus: (status: PipelineStatus) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          <Filter className="h-4 w-4" />
          <span>Filter</span>
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
