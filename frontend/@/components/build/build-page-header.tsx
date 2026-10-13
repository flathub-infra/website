import type { ComponentProps, ReactNode } from "react"
import { ArrowUpRight } from "lucide-react"
import Breadcrumbs from "src/components/Breadcrumbs"
import { cn } from "@/lib/utils"

export function BuildNavigation({
  pages = [{ name: "Builds", href: "/builds", current: true }],
}: {
  pages?: ComponentProps<typeof Breadcrumbs>["pages"]
}) {
  return (
    <div className="flex items-center gap-4 pt-5">
      <div className="min-w-0 flex-1 overflow-x-auto py-1 whitespace-nowrap">
        <Breadcrumbs pages={pages} />
      </div>
      <a
        href="https://docs.flathub.org/docs/category/for-app-authors"
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-2 text-sm"
      >
        <span className="hidden sm:inline">Developer docs</span>
        <ArrowUpRight aria-hidden="true" className="size-4" />
        <span className="sr-only sm:hidden">Developer docs</span>
      </a>
    </div>
  )
}

export function BuildPageHeader({
  title,
  description,
  actions,
  technical = false,
}: {
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  technical?: boolean
}) {
  return (
    <header className="build-page-header">
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "build-page-title",
            technical && "build-page-title-technical",
          )}
        >
          {title}
        </h1>
        <p className="build-page-description">{description}</p>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
