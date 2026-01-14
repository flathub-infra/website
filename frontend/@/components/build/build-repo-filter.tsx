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
import { Filter, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type PipelineRepoWithAll = "all" | "stable" | "test" | "beta"

const repos: PipelineRepoWithAll[] = ["all", "stable", "test", "beta"]

const repoLabels: Record<PipelineRepoWithAll, string> = {
  all: "All Repositories",
  stable: "Stable",
  test: "Test",
  beta: "Beta",
}

const repoColors: Record<PipelineRepoWithAll, string> = {
  all: "bg-muted",
  stable:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  test: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  beta: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
}

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
        <Button variant="outline" className="flex gap-2 h-12 px-4 border-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Repository
            </span>
            <Badge
              variant="static"
              className={cn("font-semibold", repoColors[selectedRepoStatus])}
            >
              {repoLabels[selectedRepoStatus]}
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-sm font-bold">
          Filter by Repository
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {repos.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selectedRepoStatus === status}
            onCheckedChange={() => setSelectedRepoStatus(status)}
            className="capitalize py-3 cursor-pointer data-[highlighted]:bg-transparent hover:bg-transparent"
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{repoLabels[status]}</span>
              {selectedRepoStatus === status && (
                <CheckCircle2 className="h-4 w-4 text-primary ml-2" />
              )}
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
