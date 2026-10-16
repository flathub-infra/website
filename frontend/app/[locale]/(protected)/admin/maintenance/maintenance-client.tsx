"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ArrowUpRight, ChevronDown, RefreshCw } from "lucide-react"
import { useEffect, useReducer, useState, type Dispatch } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import Modal from "src/components/Modal"
import Spinner from "src/components/Spinner"
import { Permission } from "src/codegen"
import {
  getMaintenanceCaseAdminMaintenanceAppIdGet,
  getMaintenanceDashboardAdminMaintenanceGet,
  updateMaintenanceCaseAdminMaintenanceAppIdPost,
} from "src/codegen/maintenance/maintenance"
import type {
  MaintenanceAction,
  MaintenanceCase,
  MaintenanceDashboard,
} from "src/codegen/model"
import { useUserContext } from "src/context/user-info"
import { Link } from "src/i18n/navigation"
import {
  caseDraftsReducer,
  createCaseDraft,
  hasUnsavedCaseDraft,
  type CaseDraft,
  type CaseDraftAction,
  type CaseDraftsAction,
} from "./case-drafts"

const credentials = { withCredentials: true }
const queues = [
  ["all", "All active"],
  ["runtime", "EOL runtime"],
  ["stale", "No recent updates"],
  ["eol", "Retired, still downloaded"],
  ["unknown", "Unknown activity"],
  ["mine", "Assigned to me"],
  ["snoozed", "Snoozed"],
] as const
type Queue = (typeof queues)[number][0]
const signalLabels = {
  runtime: "EOL runtime",
  stale: "No recent updates",
  eol: "EOL app",
  unknown: "Unknown activity",
}

function errorMessage(error: unknown) {
  if (
    axios.isAxiosError(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail
  }
  return "The request could not be completed. Please try again."
}

function utcDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown"
  }
  // Backend timestamps are naive UTC, not browser-local time.
  const date = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleDateString()
}

export function RadarQueue({
  data,
  onSelect,
  draftAppIds,
}: {
  data: MaintenanceDashboard
  onSelect: (appId: string) => void
  draftAppIds?: ReadonlySet<string>
}) {
  if (data.cases.length === 0) {
    return (
      <Alert>
        <AlertTitle>No cases in this queue</AlertTitle>
        <AlertDescription>Try another filter or search.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Table aria-label="Maintenance cases">
      <TableHeader>
        <TableRow>
          <TableHead className="ps-0">App</TableHead>
          <TableHead>Signals</TableHead>
          <TableHead className="hidden md:table-cell">Updated</TableHead>
          <TableHead className="hidden pe-0 text-end sm:table-cell">
            Downloads / 7d
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.cases.map((app) => (
          <TableRow key={app.app_id}>
            <TableCell className="w-2/5 whitespace-normal py-3 ps-0">
              <button
                className="rounded-sm py-1 text-start font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                onClick={() => onSelect(app.app_id)}
              >
                {app.name}
              </button>
              <span
                className="block max-w-[28vw] truncate text-xs text-muted-foreground sm:max-w-72 lg:max-w-96"
                dir="ltr"
                title={app.app_id}
                translate="no"
              >
                {app.app_id}
              </span>
            </TableCell>
            <TableCell className="whitespace-normal py-3">
              <div className="flex flex-wrap gap-1">
                {app.signals.map((signal) => (
                  <Badge
                    key={signal.kind}
                    variant={
                      signal.severity === "high" ? "destructive" : "outline"
                    }
                  >
                    {signalLabels[signal.kind]}
                  </Badge>
                ))}
                {app.reopened ? (
                  <Badge variant="secondary">Reopened</Badge>
                ) : null}
                {draftAppIds?.has(app.app_id) ? (
                  <Badge variant="outline">Draft</Badge>
                ) : null}
                {app.snoozed ? (
                  <Badge variant="secondary">
                    Snoozed until {utcDate(app.snoozed_until)}
                  </Badge>
                ) : null}
              </div>
              {app.owner_id !== null ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {app.owned_by_me
                    ? "Assigned to you"
                    : app.owner_name || `Moderator ${app.owner_id}`}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {utcDate(app.last_updated_at)}
            </TableCell>
            <TableCell className="hidden pe-0 text-end font-mono tabular-nums sm:table-cell">
              {app.installs_last_7_days.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CaseEditor({
  app,
  staleDays,
  draft,
  dispatchDrafts,
}: {
  app: MaintenanceCase
  staleDays: number
  draft: CaseDraft
  dispatchDrafts: Dispatch<CaseDraftsAction>
}) {
  const client = useQueryClient()
  const updateDraft = (action: CaseDraftAction) =>
    dispatchDrafts({ appId: app.app_id, savedNotes: app.notes, action })
  const notes = draft.notes.value
  const { reason, days } = draft
  const mutation = useMutation({
    mutationFn: (body: MaintenanceAction) =>
      updateMaintenanceCaseAdminMaintenanceAppIdPost(
        app.app_id,
        body,
        credentials,
      ),
    onSuccess: async (response, body) => {
      if (body.action === "notes") {
        updateDraft({
          type: "notes",
          action: {
            type: "saved",
            submitted: body.notes ?? "",
            saved: response.data.notes,
          },
        })
      }
      if (body.action === "snooze") {
        updateDraft({ type: "snoozed" })
      }
      toast.success("Case updated.")
      // Keep inputs locked until the shared version has also been refreshed.
      await client.invalidateQueries({ queryKey: ["maintenance"] })
    },
  })
  useEffect(() => {
    dispatchDrafts({
      appId: app.app_id,
      savedNotes: app.notes,
      action: { type: "notes", action: { type: "refresh", saved: app.notes } },
    })
  }, [app.app_id, app.notes, dispatchDrafts])
  const act = (action: MaintenanceAction["action"]) => {
    mutation.mutate({
      action,
      version: app.version,
      ...(action === "notes" ? { notes } : {}),
      ...(action === "snooze"
        ? { reason, days: Number(days), expected_fingerprint: app.fingerprint }
        : {}),
    })
  }
  const claimedByOther = app.owner_id !== null && !app.owned_by_me
  const unsavedNotes = notes !== app.notes
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="break-all font-mono text-xs text-muted-foreground"
          dir="ltr"
        >
          {app.app_id}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/apps/${app.app_id}`} target="_blank" rel="noreferrer">
              App <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`https://github.com/flathub/${encodeURIComponent(app.app_id)}`}
              target="_blank"
              rel="noreferrer"
            >
              Repository <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
      <Separator />
      {app.reopened ? (
        <Alert>
          <AlertTitle>This case reopened</AlertTitle>
          <AlertDescription>
            Evidence changed or needs rechecking. Previous snooze:{" "}
            {app.snooze_reason}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-8">
        <section
          aria-label="Case evidence"
          className="flex min-w-0 flex-col gap-4 md:gap-5"
        >
          {app.signals[0] ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">Next step</h4>
              <div className="text-sm leading-relaxed">
                {app.signals[0].next_step}
              </div>
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Package updated</dt>
              <dd className="tabular-nums">{utcDate(app.last_updated_at)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Downloads / 7d</dt>
              <dd className="tabular-nums">
                {app.installs_last_7_days.toLocaleString()}
              </dd>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Runtime</dt>
              <dd
                className="break-all font-mono text-xs leading-relaxed"
                dir="ltr"
              >
                {app.runtime || "Unknown"}
              </dd>
              {app.runtime_eol === null ? (
                <dd className="text-xs text-muted-foreground">
                  Support status unknown
                </dd>
              ) : null}
            </div>
          </dl>
          <div>
            {app.signals.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No current signals.
              </span>
            ) : (
              app.signals.map((signal) => (
                <details
                  key={signal.kind}
                  className="group/signal border-b last:border-0"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                    <h4 className="text-sm">
                      <Badge
                        variant={
                          signal.severity === "high" ? "destructive" : "outline"
                        }
                      >
                        {signalLabels[signal.kind]}
                      </Badge>
                    </h4>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open/signal:rotate-180 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </summary>
                  <div className="flex flex-col gap-2 pb-3 text-sm">
                    <div className="break-words text-muted-foreground">
                      {signal.evidence}
                    </div>
                    {signal.kind !== app.signals[0].kind ? (
                      <div>{signal.next_step}</div>
                    ) : null}
                  </div>
                </details>
              ))
            )}
          </div>
        </section>
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {app.owned_by_me
                ? "Assigned to you"
                : app.owner_id !== null
                  ? app.owner_name || `Moderator ${app.owner_id}`
                  : "Unassigned"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending || claimedByOther || unsavedNotes}
              onClick={() => act(app.owned_by_me ? "release" : "claim")}
            >
              {app.owned_by_me ? "Release case" : "Claim case"}
            </Button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              act("notes")
            }}
          >
            <FieldGroup className="gap-3">
              <Field className="gap-2" data-disabled={mutation.isPending}>
                <FieldLabel htmlFor="maintenance-notes">
                  Investigation notes
                </FieldLabel>
                <Textarea
                  id="maintenance-notes"
                  name="maintenance-notes"
                  autoComplete="off"
                  value={notes}
                  onChange={(event) =>
                    updateDraft({
                      type: "notes",
                      action: { type: "edit", value: event.target.value },
                    })
                  }
                  disabled={mutation.isPending}
                  maxLength={10000}
                  rows={4}
                  aria-describedby="maintenance-notes-status"
                />
              </Field>
              {draft.notes.conflict ? (
                <Alert>
                  <AlertTitle>Shared notes changed</AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-col gap-3">
                      <span>
                        Your draft is kept. Review the saved notes before
                        replacing them.
                      </span>
                      <pre className="whitespace-pre-wrap break-words text-xs">
                        {draft.notes.saved || "No saved notes."}
                      </pre>
                      <Button
                        className="self-start"
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() =>
                          updateDraft({
                            type: "notes",
                            action: { type: "discard", saved: app.notes },
                          })
                        }
                      >
                        Use saved notes
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span
                  id="maintenance-notes-status"
                  role="status"
                  className="text-xs text-muted-foreground"
                >
                  {mutation.isPending
                    ? "Saving…"
                    : unsavedNotes
                      ? "Unsaved · kept on this page"
                      : "Shared with moderators"}
                </span>
                <Button
                  size="sm"
                  disabled={mutation.isPending || !unsavedNotes}
                  type="submit"
                >
                  Save notes
                </Button>
              </div>
              {unsavedNotes ? (
                <p className="text-xs text-muted-foreground">
                  Save notes before changing case status or assignment.
                </p>
              ) : null}
            </FieldGroup>
          </form>
          <Separator />
          {app.snoozed ? (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold">
                Snoozed until {utcDate(app.snoozed_until)}
              </span>
              <span className="break-words text-sm text-muted-foreground">
                {app.snooze_reason}
              </span>
              <Button
                className="self-start"
                variant="outline"
                size="sm"
                disabled={mutation.isPending || unsavedNotes}
                onClick={() => act("wake")}
              >
                Return to active queue
              </Button>
            </div>
          ) : (
            <details className="group/snooze">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <span>Snooze</span>
                <ChevronDown
                  className="size-4 transition-transform group-open/snooze:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  act("snooze")
                }}
              >
                <FieldGroup className="gap-3">
                  <Field className="gap-2" data-disabled={mutation.isPending}>
                    <FieldLabel htmlFor="maintenance-reason">
                      Snooze reason
                    </FieldLabel>
                    <Input
                      id="maintenance-reason"
                      name="maintenance-reason"
                      autoComplete="off"
                      value={reason}
                      onChange={(event) =>
                        updateDraft({
                          type: "reason",
                          value: event.target.value,
                        })
                      }
                      disabled={mutation.isPending}
                      required
                      maxLength={2000}
                    />
                  </Field>
                  <Field className="gap-2" data-disabled={mutation.isPending}>
                    <FieldLabel htmlFor="maintenance-days">
                      Snooze for (days)
                    </FieldLabel>
                    <Input
                      id="maintenance-days"
                      name="maintenance-days"
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={days}
                      onChange={(event) =>
                        updateDraft({ type: "days", value: event.target.value })
                      }
                      disabled={mutation.isPending}
                    />
                  </Field>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      Evidence changes reopen this case.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      type="submit"
                      disabled={
                        mutation.isPending || !reason.trim() || unsavedNotes
                      }
                    >
                      Snooze case
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </details>
          )}
        </div>
      </div>
      {mutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>
            {errorMessage(mutation.error)} Your draft is kept.{" "}
            <Button
              variant="outline"
              onClick={() =>
                void client.invalidateQueries({
                  queryKey: ["maintenance", "case", app.app_id, staleDays],
                })
              }
            >
              Refresh case
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export default function MaintenanceClient() {
  const user = useUserContext()
  const allowed =
    user.info?.permissions?.includes(Permission.moderation) ?? false
  const [queue, setQueue] = useState<Queue>("all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [staleDays, setStaleDays] = useState(365)
  const [runtime, setRuntime] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [drafts, dispatchDrafts] = useReducer(caseDraftsReducer, {})
  const draftAppIds = new Set(
    Object.entries(drafts)
      .filter(([, draft]) => hasUnsavedCaseDraft(draft))
      .map(([appId]) => appId),
  )
  const unsaved = draftAppIds.size > 0
  useEffect(() => {
    if (!unsaved) {
      return
    }
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [unsaved])
  const query = useQuery({
    queryKey: ["maintenance", "queue", queue, search, staleDays, runtime, page],
    queryFn: ({ signal }) =>
      getMaintenanceDashboardAdminMaintenanceGet(
        { queue, search, stale_days: staleDays, runtime, page, page_size: 25 },
        { ...credentials, signal },
      ),
    enabled: allowed,
  })
  const detail = useQuery({
    queryKey: ["maintenance", "case", selected, staleDays],
    queryFn: ({ signal }) =>
      getMaintenanceCaseAdminMaintenanceAppIdGet(
        selected!,
        { stale_days: staleDays },
        { ...credentials, signal },
      ),
    enabled: allowed && selected !== null,
    // Refresh explicitly on a conflict; background refreshes must not replace
    // an editor's unsaved notes with a newer shared version.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const data = query.data?.data
  const currentPage = data?.page ?? page
  // The API returns a valid page after the queue shrinks. Ignore cached
  // clamped results until their current request finishes (the queue may grow).
  if (query.isSuccess && !query.isFetching && currentPage !== page) {
    setPage(currentPage)
  }
  const selectQueue = (value: Queue) => {
    setQueue(value)
    setPage(1)
    setRuntime(undefined)
  }
  return (
    <AdminLayoutClient
      condition={(info) =>
        info?.permissions?.includes(Permission.moderation) ?? false
      }
    >
      <div className="flex flex-col gap-4 px-2 pb-12 sm:gap-6 lg:pe-8 [--muted-foreground:color-mix(in_srgb,var(--foreground)_70%,var(--background))]">
        <header className="flex items-start justify-between gap-3 sm:items-center">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Maintenance Radar
          </h1>
          <Button
            variant="outline"
            size="icon"
            className="sm:w-auto sm:px-3"
            aria-label="Refresh"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </header>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:border-y sm:py-4">
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-xs text-muted-foreground">Active</dt>
            <dd className="font-mono text-base tabular-nums sm:text-3xl">
              {data?.active.toLocaleString() ?? "—"}
            </dd>
          </div>
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-xs text-muted-foreground">EOL runtimes</dt>
            <dd className="font-mono text-base tabular-nums sm:text-3xl">
              {data?.campaigns.length.toLocaleString() ?? "—"}
            </dd>
          </div>
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-1">
            <dt className="text-xs text-muted-foreground">Snoozed</dt>
            <dd className="font-mono text-base tabular-nums sm:text-3xl">
              {data?.snoozed.toLocaleString() ?? "—"}
            </dd>
          </div>
        </dl>
        {data && data.campaigns.length > 0 ? (
          <details className="group border-b pb-2 sm:pb-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-base [&::-webkit-details-marker]:hidden">
              Runtime migrations
              <ChevronDown
                className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Highest downloads first. Includes snoozed apps.
            </p>
            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              {data.campaigns.slice(0, 6).map((campaign) => (
                <Button
                  key={campaign.runtime}
                  variant="outline"
                  className="h-auto justify-between gap-3 whitespace-normal px-3 py-3"
                  onClick={() => {
                    setQueue("runtime")
                    setRuntime(campaign.runtime)
                    setPage(1)
                    setSearch("")
                    setSearchInput("")
                  }}
                >
                  <span
                    className="min-w-0 break-all text-start font-mono text-xs"
                    dir="ltr"
                  >
                    {campaign.runtime}
                  </span>
                  <span className="ms-auto shrink-0 text-xs">
                    {campaign.apps} apps
                  </span>
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              ))}
            </div>
            {data.campaigns.length > 6 ? (
              <Button
                variant="link"
                className="mt-2 px-0"
                onClick={() => selectQueue("runtime")}
              >
                All {data.campaigns.length} runtimes
              </Button>
            ) : null}
          </details>
        ) : null}
        <section
          className="flex flex-col gap-3 sm:gap-4"
          aria-label="Maintenance queue"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput)
              setPage(1)
            }}
          >
            <FieldGroup className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Field className="gap-2 sm:gap-3">
                <FieldLabel htmlFor="maintenance-queue">Queue</FieldLabel>
                <select
                  id="maintenance-queue"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={queue}
                  onChange={(event) => selectQueue(event.target.value as Queue)}
                >
                  {queues.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field className="gap-2 sm:gap-3">
                <FieldLabel htmlFor="maintenance-threshold">
                  Stale after
                </FieldLabel>
                <select
                  id="maintenance-threshold"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={staleDays}
                  onChange={(event) => {
                    setStaleDays(Number(event.target.value))
                    setPage(1)
                  }}
                >
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                  <option value={730}>2 years</option>
                </select>
              </Field>
              <Field className="col-span-2 gap-2 sm:gap-3">
                <FieldLabel htmlFor="maintenance-search">Search</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="maintenance-search"
                    name="maintenance-search"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="App name or ID"
                    value={searchInput}
                    maxLength={200}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                  <Button type="submit" variant="outline">
                    Search
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
          {runtime ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="break-all font-mono" dir="ltr">
                {runtime}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRuntime(undefined)
                  setPage(1)
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          {query.isPending ? (
            <div role="status" className="flex items-center gap-3">
              <Spinner size="m" />
              Loading…
            </div>
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load cases</AlertTitle>
              <AlertDescription>
                {errorMessage(query.error)}{" "}
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : data ? (
            <>
              <div className="text-xs text-muted-foreground" role="status">
                {data.total.toLocaleString()} cases · refreshed{" "}
                {utcDate(data.evaluated_at)}
              </div>
              <RadarQueue
                data={data}
                onSelect={setSelected}
                draftAppIds={draftAppIds}
              />
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={query.isFetching || currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <p className="text-sm">
                  Page {currentPage} of{" "}
                  {Math.max(1, Math.ceil(data.total / data.page_size))}
                </p>
                <Button
                  variant="outline"
                  disabled={
                    query.isFetching ||
                    currentPage * data.page_size >= data.total
                  }
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
      <Modal
        shown={selected !== null}
        title={detail.data?.data.name || "App investigation"}
        onClose={() => setSelected(null)}
        size="lg"
        className="[--muted-foreground:color-mix(in_srgb,var(--foreground)_70%,var(--background))]"
      >
        <div className="flex flex-col gap-4">
          {detail.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load this case</AlertTitle>
              <AlertDescription>
                {errorMessage(detail.error)}
                {detail.data
                  ? " Displayed details may be out of date. Your draft is kept."
                  : ""}
                <Button variant="outline" onClick={() => void detail.refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {detail.data ? (
            <CaseEditor
              key={detail.data.data.app_id}
              app={detail.data.data}
              staleDays={staleDays}
              draft={
                drafts[detail.data.data.app_id] ??
                createCaseDraft(detail.data.data.notes)
              }
              dispatchDrafts={dispatchDrafts}
            />
          ) : detail.isPending ? (
            <Spinner size="m" />
          ) : null}
        </div>
      </Modal>
    </AdminLayoutClient>
  )
}
