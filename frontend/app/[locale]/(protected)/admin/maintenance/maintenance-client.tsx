"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Activity, ArrowUpRight, RefreshCw, Radar } from "lucide-react"
import { useEffect, useReducer, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
import { createNotesDraft, notesDraftReducer } from "./notes-draft"

const credentials = { withCredentials: true }
const queues = [
  ["all", "All active"],
  ["runtime", "Runtime debt"],
  ["stale", "Quiet packages"],
  ["eol", "Retired, still downloaded"],
  ["unknown", "Missing activity data"],
  ["mine", "Assigned to me"],
  ["snoozed", "Snoozed"],
] as const
type Queue = (typeof queues)[number][0]
const signalLabels = {
  runtime: "EOL runtime",
  stale: "Quiet package",
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
}: {
  data: MaintenanceDashboard
  onSelect: (appId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {data.cases.length === 0 ? (
        <Alert>
          <AlertTitle>No cases in this queue</AlertTitle>
          <AlertDescription>
            Try another queue or clear your search. Missing evidence is never
            treated as proof of good health.
          </AlertDescription>
        </Alert>
      ) : (
        data.cases.map((app) => (
          <Card key={app.app_id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <CardTitle>
                    <button
                      className="text-start underline-offset-4 hover:underline focus-visible:underline"
                      onClick={() => onSelect(app.app_id)}
                    >
                      {app.name}
                    </button>
                  </CardTitle>
                  <CardDescription>
                    <span className="break-all font-mono text-xs" dir="ltr">
                      {app.app_id}
                    </span>
                  </CardDescription>
                </div>
                <div className="text-end">
                  <p className="font-mono text-xl tabular-nums">
                    {app.installs_last_7_days.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    downloads / 7 days
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
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
                {app.owner_id !== null ? (
                  <Badge variant="secondary">
                    Claimed · {app.owner_name || `Moderator ${app.owner_id}`}
                  </Badge>
                ) : null}
                {app.reopened ? (
                  <Badge variant="secondary">Review needed · reopened</Badge>
                ) : null}
                {app.snoozed ? (
                  <Badge variant="secondary">
                    Snoozed until {utcDate(app.snoozed_until)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm">{app.signals[0]?.evidence}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Last package update: {utcDate(app.last_updated_at)}
                  {app.days_since_update !== null
                    ? ` · ${app.days_since_update} days ago`
                    : ""}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(app.app_id)}
                >
                  Investigate <ArrowUpRight data-icon="inline-end" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function CaseEditor({
  app,
  staleDays,
}: {
  app: MaintenanceCase
  staleDays: number
}) {
  const client = useQueryClient()
  const [draft, dispatchDraft] = useReducer(
    notesDraftReducer,
    app.notes,
    createNotesDraft,
  )
  const notes = draft.value
  const [reason, setReason] = useState("")
  const [days, setDays] = useState("30")
  const mutation = useMutation({
    mutationFn: (body: MaintenanceAction) =>
      updateMaintenanceCaseAdminMaintenanceAppIdPost(
        app.app_id,
        body,
        credentials,
      ),
    onSuccess: async (response, body) => {
      if (body.action === "notes") {
        dispatchDraft({
          type: "saved",
          submitted: body.notes ?? "",
          saved: response.data.notes,
        })
      }
      if (body.action === "snooze") {
        setReason("")
      }
      toast.success("Case updated.")
      // Keep inputs locked until the shared version has also been refreshed.
      await client.invalidateQueries({ queryKey: ["maintenance"] })
    },
  })
  useEffect(() => {
    dispatchDraft({ type: "refresh", saved: app.notes })
  }, [app.notes])
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/apps/${app.app_id}`}>
            App page <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <a
            href={`https://github.com/flathub/${encodeURIComponent(app.app_id)}`}
            target="_blank"
            rel="noreferrer"
          >
            Packaging repository <ArrowUpRight data-icon="inline-end" />
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Repository link is a lookup, not proof that this app is hosted on
        GitHub; direct uploads may be maintained elsewhere.
      </p>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Package updated</dt>
          <dd>{utcDate(app.last_updated_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Downloads / 7 days</dt>
          <dd>
            {app.installs_last_7_days.toLocaleString()} (not active users)
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Runtime</dt>
          <dd className="break-all font-mono" dir="ltr">
            {app.runtime || "Unknown"}
          </dd>
          <dd>
            {app.runtime_eol === null
              ? "Support status unknown"
              : app.runtime_eol
                ? "Branch marked end of life"
                : "Not marked end of life"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3">
        {app.signals.length === 0 ? (
          <Alert>
            <AlertTitle>No current maintenance signals</AlertTitle>
            <AlertDescription>
              The evidence no longer matches the selected threshold.
            </AlertDescription>
          </Alert>
        ) : (
          app.signals.map((signal) => (
            <Alert key={signal.kind}>
              <AlertTitle>
                {signalLabels[signal.kind]} · {signal.confidence}
              </AlertTitle>
              <AlertDescription>
                <p>{signal.evidence}</p>
                <p>{signal.next_step}</p>
              </AlertDescription>
            </Alert>
          ))
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Upstream releases, build failures, and maintainer responsiveness are not
        connected yet. Package age alone does not mean abandonment.
      </p>
      <Separator />
      {app.reopened ? (
        <Alert>
          <AlertTitle>This case reopened</AlertTitle>
          <AlertDescription>
            The evidence changed after it was snoozed, or the saved fingerprint
            format is no longer supported. Previous reason: {app.snooze_reason}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={mutation.isPending || claimedByOther || unsavedNotes}
          onClick={() => act(app.owned_by_me ? "release" : "claim")}
        >
          {app.owned_by_me ? "Release case" : "Claim case"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {app.owner_id !== null
            ? `Claimed by ${app.owner_name || `moderator ${app.owner_id}`}`
            : "Unassigned"}
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          act("notes")
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="maintenance-notes">
              Investigation notes
            </FieldLabel>
            <Textarea
              id="maintenance-notes"
              value={notes}
              onChange={(event) =>
                dispatchDraft({ type: "edit", value: event.target.value })
              }
              disabled={mutation.isPending}
              maxLength={10000}
              rows={4}
            />
            <FieldDescription>
              Shared with other moderators. Record evidence, outreach, and next
              steps. Save notes before claiming or snoozing this case.
            </FieldDescription>
          </Field>
          {draft.conflict ? (
            <Alert>
              <AlertTitle>Shared notes changed</AlertTitle>
              <AlertDescription>
                <p>
                  Your draft is preserved. Review the latest saved notes before
                  saving over them.
                </p>
                <pre className="whitespace-pre-wrap break-words">
                  {draft.saved || "No saved notes."}
                </pre>
                <Button
                  variant="outline"
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    dispatchDraft({ type: "discard", saved: app.notes })
                  }
                >
                  Use saved notes instead
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            className="self-start"
            variant="outline"
            disabled={mutation.isPending || notes === app.notes}
            type="submit"
          >
            Save notes
          </Button>
        </FieldGroup>
      </form>
      {app.snoozed ? (
        <Alert>
          <AlertTitle>Snoozed until {utcDate(app.snoozed_until)}</AlertTitle>
          <AlertDescription>
            <p>{app.snooze_reason}</p>
            <Button
              variant="outline"
              disabled={mutation.isPending || unsavedNotes}
              onClick={() => act("wake")}
            >
              Return to active queue
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            act("snooze")
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="maintenance-reason">
                Snooze reason
              </FieldLabel>
              <Input
                id="maintenance-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
                required
                maxLength={2000}
                placeholder="Waiting for a maintainer response…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="maintenance-days">
                Snooze for (days)
              </FieldLabel>
              <Input
                id="maintenance-days"
                type="number"
                min={1}
                max={365}
                required
                value={days}
                onChange={(event) => setDays(event.target.value)}
                disabled={mutation.isPending}
              />
              <FieldDescription>
                Reopens automatically when package, runtime, or EOL evidence
                changes. Daily age and download fluctuations do not reopen it.
              </FieldDescription>
            </Field>
            <Button
              className="self-start"
              variant="outline"
              type="submit"
              disabled={mutation.isPending || !reason.trim() || unsavedNotes}
            >
              Snooze case
            </Button>
          </FieldGroup>
        </form>
      )}
      {mutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>
            {errorMessage(mutation.error)} Your draft will be kept when you
            refresh.{" "}
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
      <p role="status" className="text-sm text-muted-foreground">
        {mutation.isPending ? "Saving…" : ""}
      </p>
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
      <div className="flex flex-col gap-8 px-2 pb-12 lg:pe-8 [--muted-foreground:color-mix(in_srgb,var(--foreground)_85%,var(--background))]">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Radar className="size-4" aria-hidden /> Catalog operations
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Maintenance Radar
            </h1>
            <p className="max-w-xl text-muted-foreground">
              Less dashboard. More direction. Find the apps that need a closer
              look—and turn evidence into action.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh evidence
          </Button>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Active investigations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-4xl tabular-nums">
                {data?.active.toLocaleString() ?? "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Signals, not verdicts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Runtime migration groups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-4xl tabular-nums">
                {data?.campaigns.length.toLocaleString() ?? "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                One dependency, many affected apps
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Snoozed cases</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-4xl tabular-nums">
                {data?.snoozed.toLocaleString() ?? "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Wake on evidence changes
              </p>
            </CardContent>
          </Card>
        </div>
        {data && data.campaigns.length > 0 ? (
          <section
            className="flex flex-col gap-4"
            aria-labelledby="runtime-earthquake"
          >
            <div>
              <h2
                id="runtime-earthquake"
                className="flex items-center gap-2 text-xl font-bold"
              >
                <Activity className="size-5" aria-hidden /> Runtime earthquake
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Group the migration, not the alarms. Includes snoozed apps;
                counts use downloads, not active users.
              </p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {data.campaigns.slice(0, 6).map((campaign) => (
                <Card key={campaign.runtime}>
                  <CardHeader>
                    <CardTitle>
                      <span className="break-all font-mono text-sm" dir="ltr">
                        {campaign.runtime}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      End-of-life branch · {campaign.apps} affected apps ·{" "}
                      {campaign.installs_last_7_days.toLocaleString()} downloads
                      / 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQueue("runtime")
                        setRuntime(campaign.runtime)
                        setPage(1)
                        setSearch("")
                        setSearchInput("")
                      }}
                    >
                      Open migration queue{" "}
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {data.campaigns.length > 6 ? (
              <p className="text-xs text-muted-foreground">
                Showing the six highest-reach groups. All affected apps are
                available in Runtime debt.
              </p>
            ) : null}
          </section>
        ) : null}
        <section className="flex flex-col gap-5" aria-labelledby="action-queue">
          <div>
            <h2 id="action-queue" className="text-xl font-bold">
              Action queue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ordered by signal severity, then recent downloads, then package
              age. No opaque health score.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput)
              setPage(1)
            }}
          >
            <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field>
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
              <Field>
                <FieldLabel htmlFor="maintenance-threshold">
                  Quiet-package threshold
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
                  <option value={180}>6 months (180 days)</option>
                  <option value={365}>1 year (365 days)</option>
                  <option value={730}>2 years (730 days)</option>
                </select>
              </Field>
              <Field className="xl:col-span-2">
                <FieldLabel htmlFor="maintenance-search">
                  Search apps
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="maintenance-search"
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
                Runtime filter: {runtime}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRuntime(undefined)
                  setPage(1)
                }}
              >
                Clear runtime filter
              </Button>
            </div>
          ) : null}
          {query.isPending ? (
            <div role="status" className="flex items-center gap-3">
              <Spinner size="m" />
              Loading maintenance evidence…
            </div>
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load Maintenance Radar</AlertTitle>
              <AlertDescription>
                {errorMessage(query.error)}{" "}
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : data ? (
            <>
              <p className="text-xs text-muted-foreground" role="status">
                {data.total.toLocaleString()} matching cases · evaluated{" "}
                {utcDate(data.evaluated_at)}
              </p>
              <RadarQueue data={data} onSelect={setSelected} />
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
        <Alert>
          <AlertTitle>Old does not necessarily mean neglected</AlertTitle>
          <AlertDescription>
            A finished app can be healthy without new releases. Runtime support
            and package activity are separate signals. Upstream/build/maintainer
            evidence is not available yet.
          </AlertDescription>
        </Alert>
      </div>
      <Modal
        shown={selected !== null}
        title={detail.data?.data.name || "App investigation"}
        onClose={() => setSelected(null)}
        size="lg"
        className="[--muted-foreground:color-mix(in_srgb,var(--foreground)_85%,var(--background))]"
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
            />
          ) : detail.isPending ? (
            <Spinner size="m" />
          ) : null}
        </div>
      </Modal>
    </AdminLayoutClient>
  )
}
