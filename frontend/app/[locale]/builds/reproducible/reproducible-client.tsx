"use client"

import { Suspense, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  useReproducibleApiApiReproducibleGet,
  type ReproCheckEntry,
  type ReproducibilityData,
  type ReproducibleApiApiReproducibleGetStatus,
} from "src/codegen-pipeline"
import { Link } from "src/i18n/navigation"
import { BuildStatusBanner } from "@/components/build/build-status-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BuildNavigation,
  BuildPageHeader,
} from "@/components/build/build-page-header"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Search,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  CircleX,
  TriangleAlert,
} from "lucide-react"
import Spinner from "src/components/Spinner"

const categories: {
  key: keyof ReproducibilityData
  label: string
  filter: ReproducibleApiApiReproducibleGetStatus
}[] = [
  { key: "reproducible", label: "Reproducible", filter: "reproducible" },
  { key: "unreproducible", label: "Unreproducible", filter: "unreproducible" },
  { key: "failed_to_rebuild", label: "Failed to rebuild", filter: "failed" },
  { key: "unknown", label: "Unknown", filter: "none" },
]

const categoryIcons = [CheckCircle2, CircleX, TriangleAlert, CircleHelp]

function FleetCategory({
  title,
  entries,
  expanded,
  unreproducible,
}: {
  title: string
  entries: ReproCheckEntry[]
  expanded: boolean
  unreproducible: boolean
}) {
  return (
    <details
      open={expanded}
      key={`${title}:${expanded}`}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <summary className="cursor-pointer px-5 py-4 font-semibold hover:bg-muted/60">
        {title}{" "}
        <span className="ms-2 font-mono text-sm font-normal text-muted-foreground">
          {entries.length.toLocaleString()}
        </span>
      </summary>
      <div className="overflow-x-auto border-t">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No apps in this category
          </p>
        ) : (
          <table className="build-data-table">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">App</th>
                <th className="py-2 text-left">Commit</th>
                <th className="py-2 text-left">Published build</th>
                <th className="py-2 text-left">Reprocheck</th>
                <th className="py-2 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.app_id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <Link
                      className="font-mono text-xs hover:underline"
                      href={`/builds/apps/${entry.app_id}`}
                    >
                      {entry.app_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    {entry.git_repo && entry.build_commit ? (
                      <a
                        className="font-mono text-xs hover:underline"
                        href={`https://github.com/${entry.git_repo}/commit/${entry.build_commit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.build_commit.slice(0, 7)}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {entry.finished_at
                      ? new Date(entry.finished_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="py-3 pr-4">
                    {entry.reprocheck_log_url ? (
                      <a
                        href={entry.reprocheck_log_url}
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Workflow
                      </a>
                    ) : (
                      "-"
                    )}
                    {entry.repro_pipeline_id && (
                      <>
                        {" "}
                        ·{" "}
                        <Link
                          className="underline"
                          href={`/builds/${entry.repro_pipeline_id}`}
                        >
                          Details
                        </Link>
                      </>
                    )}
                  </td>
                  <td className="py-3">
                    {unreproducible &&
                    entry.repro_pipeline_id &&
                    entry.result_url ? (
                      <a
                        className="underline"
                        href={`https://builds.flathub.org/diffoscope/${entry.repro_pipeline_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Diffoscope
                      </a>
                    ) : entry.result_url ? (
                      <a
                        className="underline"
                        href={entry.result_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Result
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  )
}

function FleetContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const appId = searchParams.get("appId") || ""
  const statusValue = searchParams.get("status") || ""
  const status = categories.find(
    (category) => category.filter === statusValue,
  )?.filter
  const [draft, setDraft] = useState(appId)
  useEffect(() => setDraft(appId), [appId])
  const update = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(params.size ? `${pathname}?${params}` : pathname)
  }
  const query = useReproducibleApiApiReproducibleGet(
    { app_id: appId || undefined, status },
    { query: { refetchInterval: 30000 } },
  )
  const data = query.data?.data
  return (
    <div className="build-page">
      <BuildNavigation
        pages={[
          { name: "Builds", href: "/builds", current: false },
          {
            name: "Reproducibility",
            href: "/builds/reproducible",
            current: true,
          },
        ]}
      />
      <BuildPageHeader
        title="Build reproducibility"
        description="Independent rebuilds check whether published apps can be reproduced from source. Explore the latest results across Flathub."
      />
      <BuildStatusBanner />
      {data && (
        <section
          aria-label="Reproducibility results for the current filters"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {(appId || status) && (
            <p className="col-span-full text-xs text-muted-foreground">
              Results for the current filters
            </p>
          )}
          {categories.map((category, index) => {
            const Icon = categoryIcons[index]
            return (
              <button
                key={category.key}
                onClick={() =>
                  update({
                    status: status === category.filter ? "" : category.filter,
                  })
                }
                aria-pressed={status === category.filter}
                className="group flex flex-col gap-5 rounded-xl border bg-card p-4 text-start transition-colors hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary/5 sm:p-5"
              >
                <span className="flex items-center justify-between gap-2 text-muted-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
                  />
                </span>
                <span className="font-mono text-3xl tracking-tight tabular-nums">
                  {data[category.key].length.toLocaleString()}
                </span>
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            )
          })}
        </section>
      )}
      <section
        className="build-filter-panel"
        aria-label="Filter reproducibility results"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor="repro-search" className="sr-only">
              Search apps
            </FieldLabel>
            <Input
              id="repro-search"
              className="h-9"
              aria-label="Search apps"
              placeholder="Search app IDs"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") update({ appId: draft.trim() })
              }}
            />
          </Field>
          <Button onClick={() => update({ appId: draft.trim() })}>
            <Search data-icon="inline-start" />
            Search
          </Button>
          <select
            aria-label="Reproducibility status"
            className="h-9 max-w-full rounded-lg border bg-background px-3 text-sm"
            value={status || ""}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {categories.map((category) => (
              <option key={category.key} value={category.filter}>
                {category.label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            disabled={!draft && !status && !appId}
            onClick={() => {
              setDraft("")
              update({ appId: "", status: "" })
            }}
          >
            Clear filters
          </Button>
        </div>
      </section>
      {query.isPending && <Spinner size="m" />}
      {query.isError && !data && (
        <p role="alert" className="text-destructive">
          Could not load reproducibility data.{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && query.isRefetchError && (
        <p role="alert" className="text-destructive">
          Refresh failed; showing the last report.
        </p>
      )}
      {data &&
        categories.every((category) => data[category.key].length === 0) && (
          <p>No matching apps</p>
        )}
      {data &&
        categories.map((category) => (
          <FleetCategory
            key={category.key}
            title={category.label}
            entries={data[category.key]}
            expanded={Boolean(appId || status)}
            unreproducible={category.key === "unreproducible"}
          />
        ))}
    </div>
  )
}

export default function ReproducibleClient() {
  return (
    <Suspense fallback={<Spinner size="m" />}>
      <FleetContent />
    </Suspense>
  )
}
