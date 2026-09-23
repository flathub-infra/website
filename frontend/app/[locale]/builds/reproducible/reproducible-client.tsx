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
import { Card, CardContent } from "@/components/ui/card"
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
      className="rounded-lg border bg-card"
    >
      <summary className="cursor-pointer px-6 py-4 font-semibold">
        {title} ({entries.length})
      </summary>
      <div className="overflow-x-auto px-6 pb-4">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">No apps in this category</p>
        ) : (
          <table className="w-full text-sm">
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
                      className="underline"
                      href={`/builds/apps/${entry.app_id}`}
                    >
                      {entry.app_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    {entry.git_repo && entry.build_commit ? (
                      <a
                        className="underline"
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
                    {unreproducible && entry.repro_pipeline_id ? (
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
    <div className="max-w-11/12 mx-auto mt-4 w-11/12 space-y-6 2xl:w-[1400px]">
      <h1 className="text-4xl font-bold">Build reproducibility</h1>
      <Link href="/builds" className="underline">
        Back to Build Dashboard
      </Link>
      <BuildStatusBanner />
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Input
            aria-label="Search apps"
            className="max-w-md"
            placeholder="Search app IDs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") update({ appId: draft.trim() })
            }}
          />
          <Button onClick={() => update({ appId: draft.trim() })}>
            Search
          </Button>
          <select
            aria-label="Reproducibility status"
            className="rounded border bg-background px-3"
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
            variant="outline"
            onClick={() => {
              setDraft("")
              update({ appId: "", status: "" })
            }}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>
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
            expanded={Boolean(appId)}
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
