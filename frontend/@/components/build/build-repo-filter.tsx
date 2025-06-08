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

export type PipelineRepoWithAll = "all" | "stable" | "test" | "beta"

const repos: PipelineRepoWithAll[] = ["all", "stable", "test", "beta"]

export function BuildRepoFilter({
  selectedRepoStatus,
  setSelectedRepoStatus,
}: {
  selectedRepoStatus: PipelineRepoWithAll
  setSelectedRepoStatus: (status: PipelineRepoWithAll) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          <Filter className="h-4 w-4" />
          <span>Repo Filter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Repo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {repos.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selectedRepoStatus === status}
            onCheckedChange={() => setSelectedRepoStatus(status)}
            className="capitalize"
          >
            {status}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
