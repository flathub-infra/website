import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { delay, http, HttpResponse } from "msw"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"
import { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Permission } from "src/codegen"
import type { MaintenanceCase, MaintenanceDashboard } from "src/codegen/model"
import { UserContext } from "src/context/user-info"
import MaintenanceClient from "./maintenance-client"

// Fictional evidence only: these names never make maintenance claims about real apps.
const fixture: MaintenanceCase[] = [
  {
    app_id: "org.example.StarChart",
    name: "Star Chart",
    last_updated_at: "2024-08-10T12:00:00",
    days_since_update: 794,
    installs_last_7_days: 4210,
    runtime: "org.example.Platform/x86_64/old",
    runtime_eol: true,
    signals: [
      {
        kind: "runtime",
        severity: "high",
        confidence: "confirmed",
        evidence:
          "The runtime branch org.example.Platform/x86_64/old is marked end of life.",
        next_step: "Check the manifest and plan a supported-runtime migration.",
      },
      {
        kind: "stale",
        severity: "medium",
        confidence: "investigate",
        evidence: "No recorded package update in 794 days (threshold: 365).",
        next_step:
          "Compare upstream releases and packaging activity. Age alone is not abandonment.",
      },
    ],
    fingerprint: "v1:" + "1".repeat(64),
    owner_id: null,
    owner_name: null,
    owned_by_me: false,
    notes: "",
    snoozed_until: null,
    snooze_reason: "",
    snoozed: false,
    reopened: false,
    version: 0,
  },
  {
    app_id: "org.example.PaperPlane",
    name: "Paper Plane",
    last_updated_at: "2026-09-20T12:00:00",
    days_since_update: 23,
    installs_last_7_days: 892,
    runtime: "org.example.Platform/x86_64/old",
    runtime_eol: true,
    signals: [
      {
        kind: "runtime",
        severity: "high",
        confidence: "confirmed",
        evidence:
          "The runtime branch org.example.Platform/x86_64/old is marked end of life.",
        next_step: "Check the manifest and plan a supported-runtime migration.",
      },
    ],
    fingerprint: "v1:" + "2".repeat(64),
    owner_id: 42,
    owner_name: "Demo moderator",
    owned_by_me: true,
    notes: "Maintainer contacted; migration planned.",
    snoozed_until: null,
    snooze_reason: "",
    snoozed: false,
    reopened: false,
    version: 1,
  },
  {
    app_id: "org.example.PocketClock",
    name: "Pocket Clock",
    last_updated_at: null,
    days_since_update: null,
    installs_last_7_days: 12,
    runtime: null,
    runtime_eol: null,
    signals: [
      {
        kind: "unknown",
        severity: "low",
        confidence: "unknown",
        evidence: "No package-update timestamp is available.",
        next_step:
          "Check repository history before drawing conclusions about maintenance.",
      },
    ],
    fingerprint: "v1:" + "3".repeat(64),
    owner_id: null,
    owner_name: null,
    owned_by_me: false,
    notes: "",
    snoozed_until: null,
    snooze_reason: "",
    snoozed: false,
    reopened: false,
    version: 0,
  },
]
let cases = structuredClone(fixture)
let saveDelayMs = 0
let failNextRefresh = false

const handlers = [
  http.get("*/admin/maintenance", ({ request }) => {
    const params = new URL(request.url).searchParams
    const queue = params.get("queue") || "all"
    const search = (params.get("search") || "").toLowerCase()
    const selected = cases.filter(
      (app) =>
        (queue === "snoozed" ? app.snoozed : !app.snoozed) &&
        (queue === "all" ||
          queue === "snoozed" ||
          (queue === "mine"
            ? app.owned_by_me
            : app.signals.some((s) => s.kind === queue))) &&
        (!params.get("runtime") || app.runtime === params.get("runtime")) &&
        `${app.name} ${app.app_id}`.toLowerCase().includes(search),
    )
    const pageSize = Number(params.get("page_size")) || 25
    const page = Math.min(
      Number(params.get("page")) || 1,
      Math.max(1, Math.ceil(selected.length / pageSize)),
    )
    const campaigns: MaintenanceDashboard["campaigns"] = []
    for (const app of cases) {
      if (!app.runtime || !app.runtime_eol) {
        continue
      }
      let campaign = campaigns.find((group) => group.runtime === app.runtime)
      if (!campaign) {
        campaign = { runtime: app.runtime, apps: 0, installs_last_7_days: 0 }
        campaigns.push(campaign)
      }
      campaign.apps += 1
      campaign.installs_last_7_days += app.installs_last_7_days
    }
    return HttpResponse.json({
      cases: selected.slice((page - 1) * pageSize, page * pageSize),
      total: selected.length,
      active: cases.filter((app) => !app.snoozed).length,
      snoozed: cases.filter((app) => app.snoozed).length,
      page,
      page_size: pageSize,
      campaigns,
      evaluated_at: "2026-10-13T12:00:00",
    } satisfies MaintenanceDashboard)
  }),
  http.get("*/admin/maintenance/:appId", ({ params }) => {
    if (failNextRefresh) {
      failNextRefresh = false
      return HttpResponse.json(
        { detail: "Refresh temporarily unavailable." },
        { status: 503 },
      )
    }
    return HttpResponse.json(cases.find((app) => app.app_id === params.appId))
  }),
  http.post("*/admin/maintenance/:appId", async ({ params, request }) => {
    const body = (await request.json()) as {
      action: string
      version: number
      notes?: string
      reason?: string
      days?: number
      expected_fingerprint?: string
    }
    const app = cases.find((app) => app.app_id === params.appId)!
    if (body.action === "notes" && saveDelayMs > 0) {
      await delay(saveDelayMs)
    }
    if (body.version !== app.version) {
      return HttpResponse.json(
        { detail: "This case changed. Refresh it before editing." },
        { status: 409 },
      )
    }
    if (body.action === "claim" || body.action === "release") {
      app.owned_by_me = body.action === "claim"
      app.owner_id = app.owned_by_me ? 42 : null
      app.owner_name = app.owned_by_me ? "Demo moderator" : null
    }
    if (body.action === "notes") {
      app.notes = body.notes || ""
    }
    if (body.action === "snooze") {
      if (body.expected_fingerprint !== app.fingerprint) {
        return HttpResponse.json(
          {
            detail: "Maintenance evidence changed. Refresh it before snoozing.",
          },
          { status: 409 },
        )
      }
      app.snoozed = true
      app.snooze_reason = body.reason || ""
      app.snoozed_until = new Date(
        Date.UTC(2026, 9, 13 + (body.days || 30)),
      ).toISOString()
    }
    if (body.action === "wake") {
      app.snoozed = false
      app.snoozed_until = null
    }
    app.version += 1
    return HttpResponse.json(app)
  }),
]

function DemoProvider({
  children,
  permissions,
}: {
  children: React.ReactNode
  permissions: Permission[]
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    // Next 16.4's useRouter expects a new LayoutRouterContext shape that
    // Storybook's appDirectory wrapper does not yet provide. Supply the small
    // navigation context this isolated admin story needs instead.
    <AppRouterContext
      value={{
        back() {},
        forward() {},
        refresh() {},
        hmrRefresh() {},
        push() {},
        replace() {},
        prefetch() {},
      }}
    >
      <PathnameContext value="/admin/maintenance">
        <QueryClientProvider client={client}>
          <UserContext
            value={{
              loading: false,
              info: {
                displayname: "Demo moderator",
                permissions,
                invite_code: "demo",
                accepted_publisher_agreement_at: null,
                default_account: { login: "demo", provider: "github" },
                auths: {},
              },
            }}
          >
            {children}
          </UserContext>
        </QueryClientProvider>
      </PathnameContext>
    </AppRouterContext>
  )
}

const meta = {
  title: "Admin/Maintenance Radar",
  component: MaintenanceClient,
  parameters: {
    layout: "padded",
    nextjs: {
      appDirectory: false,
      navigation: { pathname: "/admin/maintenance" },
    },
    msw: { handlers },
  },
  loaders: [
    ({ parameters }) => {
      cases = structuredClone(fixture)
      if (parameters.maintenanceScenario === "pagination") {
        cases = Array.from({ length: 26 }, (_, index) => ({
          ...structuredClone(fixture[0]),
          app_id: `org.example.Backlog${String(index + 1).padStart(2, "0")}`,
          name: `Backlog ${index + 1}`,
          fingerprint: "v1:" + (index + 10).toString(16).padStart(64, "0"),
        }))
      } else if (parameters.maintenanceScenario === "evidence-conflict") {
        cases[0].runtime_eol = false
        cases[0].runtime = "org.example.Platform/x86_64/new"
        cases[0].signals = cases[0].signals.filter(
          (signal) => signal.kind !== "runtime",
        )
      }
      saveDelayMs = parameters.maintenanceScenario === "delayed-save" ? 500 : 0
      failNextRefresh = false
      return {}
    },
  ],
  decorators: [
    (Story, { parameters }) => (
      <DemoProvider
        permissions={
          parameters.maintenancePermissions ?? [Permission.moderation]
        }
      >
        <Story />
      </DemoProvider>
    ),
  ],
} satisfies Meta<typeof MaintenanceClient>

export default meta
type Story = StoryObj<typeof meta>
export const ActionQueue: Story = {}
export const FullQueue: Story = {
  parameters: { maintenanceScenario: "pagination" },
}

export const CaseDetails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    await screen.findByLabelText("Investigation notes")
    await expect(
      screen.getByText("Snooze", { exact: true }).closest("details"),
    ).not.toHaveAttribute("open")
    await expect(
      screen.getByRole("button", { name: "Claim case" }),
    ).toBeEnabled()
    await expect(
      screen.getByRole("button", { name: "Save notes" }),
    ).toBeDisabled()
  },
}

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    const trigger = await canvas.findByRole("button", { name: "Star Chart" })
    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog")
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Close" }),
      ).toHaveFocus(),
    )
    await userEvent.tab()
    await expect(dialog).toContainElement(
      canvasElement.ownerDocument.activeElement as HTMLElement,
    )
    await userEvent.tab({ shift: true })
    await expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toHaveFocus()
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    await expect(trigger).toHaveFocus()
  },
}

export const DisclosureKeepsDrafts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    const notes = await screen.findByLabelText("Investigation notes")
    await userEvent.type(notes, "Migration investigation")
    await expect(
      screen.getByText("Save notes before changing case status or assignment."),
    ).toBeVisible()
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    const reason = screen.getByLabelText("Snooze reason")
    await userEvent.type(reason, "Waiting for a runtime update")
    await expect(
      screen.getByRole("button", { name: "Snooze case" }),
    ).toBeDisabled()
    await expect(
      screen.getByRole("button", { name: "Claim case" }),
    ).toBeDisabled()
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    await expect(notes).toHaveValue("Migration investigation")
    await expect(reason).toHaveValue("Waiting for a runtime update")
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Snooze case" })).toBeEnabled(),
    )
    await expect(
      screen.queryByText(
        "Save notes before changing case status or assignment.",
      ),
    ).not.toBeInTheDocument()
    await expect(reason).toHaveValue("Waiting for a runtime update")
  },
}

export const ClosingKeepsCaseDrafts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    await userEvent.type(
      await screen.findByLabelText("Investigation notes"),
      "My unsaved investigation",
    )
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    await userEvent.type(
      screen.getByLabelText("Snooze reason"),
      "Waiting for a reply",
    )
    await userEvent.clear(screen.getByLabelText("Snooze for (days)"))
    await userEvent.type(screen.getByLabelText("Snooze for (days)"), "7")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    await expect(canvas.getByText("Draft", { exact: true })).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Paper Plane" }))
    await expect(
      await screen.findByLabelText("Investigation notes"),
    ).toHaveValue(fixture[1].notes)
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    cases[0].notes = "Another moderator's saved notes"
    cases[0].version += 1
    await userEvent.click(canvas.getByRole("button", { name: "Star Chart" }))
    await screen.findByText("Shared notes changed")
    await expect(screen.getByLabelText("Investigation notes")).toHaveValue(
      "My unsaved investigation",
    )
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    await expect(screen.getByLabelText("Snooze reason")).toHaveValue(
      "Waiting for a reply",
    )
    await expect(screen.getByLabelText("Snooze for (days)")).toHaveValue(7)
  },
}

export const SaveFinishesAfterClose: Story = {
  parameters: { maintenanceScenario: "delayed-save" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const notes = await screen.findByLabelText("Investigation notes")
    await userEvent.type(notes, "Saved while the dialog was closing")
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }))
    await waitFor(() => expect(notes).toBeDisabled())
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(cases[0].notes).toBe("Saved while the dialog was closing"),
    )
    await waitFor(() =>
      expect(
        canvas.queryByText("Draft", { exact: true }),
      ).not.toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Star Chart" }))
    await waitFor(() =>
      expect(screen.getByLabelText("Investigation notes")).toHaveValue(
        cases[0].notes,
      ),
    )
  },
}

export const RuntimeFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Star Chart" })
    const groups = canvas.getByText("Runtime migrations").closest("details")!
    await expect(groups).not.toHaveAttribute("open")
    await userEvent.click(canvas.getByText("Runtime migrations"))
    await userEvent.click(
      canvas.getByRole("button", { name: /org.example.Platform\/x86_64\/old/ }),
    )
    await waitFor(() =>
      expect(canvas.getByLabelText("Queue")).toHaveValue("runtime"),
    )
    await canvas.findByRole("button", { name: "Clear" })
    await expect(
      canvas.queryByRole("button", { name: "Pocket Clock" }),
    ).not.toBeInTheDocument()
  },
}

export const QualityOnlyModeratorCannotAccess: Story = {
  parameters: { maintenancePermissions: [Permission["quality-moderation"]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText("You are unauthorized to view this content.")
    await expect(
      canvas.queryByRole("heading", { name: "Maintenance Radar" }),
    ).not.toBeInTheDocument()
  },
}

export const SnoozeRejectsUnreviewedEvidence: Story = {
  parameters: { maintenanceScenario: "evidence-conflict" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    await screen.findByLabelText("Investigation notes")
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    await userEvent.type(
      screen.getByLabelText("Snooze reason"),
      "Waiting for packaging updates",
    )
    // Background ingestion introduces a runtime alarm without editing triage.
    cases[0].runtime_eol = true
    cases[0].runtime = fixture[0].runtime
    cases[0].signals.unshift(fixture[0].signals[0])
    cases[0].fingerprint = "v1:" + "a".repeat(64)
    await userEvent.click(screen.getByRole("button", { name: "Snooze case" }))
    await screen.findByText(/Maintenance evidence changed/)
    await expect(cases[0].snoozed).toBe(false)
    await userEvent.click(screen.getByRole("button", { name: "Refresh case" }))
    await screen.findByRole("heading", { name: "EOL runtime", exact: true })
    await expect(screen.getByLabelText("Snooze reason")).toHaveValue(
      "Waiting for packaging updates",
    )
    await userEvent.click(screen.getByRole("button", { name: "Snooze case" }))
    await screen.findByRole("button", { name: "Return to active queue" })
    await expect(cases[0].snoozed).toBe(true)
  },
}

export const SnoozeClampsLastPage: Story = {
  parameters: { maintenanceScenario: "pagination" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Backlog 1" })
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    await userEvent.click(
      await canvas.findByRole("button", { name: "Backlog 26" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByText("Snooze", { exact: true }))
    await userEvent.type(
      await screen.findByLabelText("Snooze reason"),
      "Waiting for maintainer",
    )
    await userEvent.click(screen.getByRole("button", { name: "Snooze case" }))
    await screen.findByRole("button", { name: "Return to active queue" })
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    await canvas.findByText("Page 1 of 1")
    await expect(
      canvas.getByRole("button", { name: "Backlog 1" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "Backlog 26" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("button", { name: "Previous" }),
    ).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Next" })).toBeDisabled()
    // Re-growing the queue must not reuse a cached clamped page indefinitely.
    await userEvent.selectOptions(canvas.getByLabelText("Queue"), "snoozed")
    await userEvent.click(
      await canvas.findByRole("button", { name: "Backlog 26" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Return to active queue" }),
    )
    await waitFor(() => expect(cases[25].snoozed).toBe(false))
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    await userEvent.selectOptions(canvas.getByLabelText("Queue"), "all")
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Next" })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    await canvas.findByRole("button", { name: "Backlog 26" })
    await canvas.findByText("Page 2 of 2")
  },
}

export const DelayedSavePreservesDrafts: Story = {
  parameters: { maintenanceScenario: "delayed-save" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    const notes = await screen.findByLabelText("Investigation notes")
    await userEvent.click(screen.getByText("Snooze", { exact: true }))
    const reason = screen.getByLabelText("Snooze reason")
    await userEvent.type(notes, "First investigation")
    await userEvent.type(reason, "Waiting for a maintainer")
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }))
    await waitFor(() => expect(notes).toBeDisabled())
    await expect(reason).toBeDisabled()
    await userEvent.type(notes, "Must not get lost")
    await waitFor(() => expect(notes).toBeEnabled())
    await expect(notes).toBeInTheDocument()
    await expect(notes).toHaveValue("First investigation")
    await expect(reason).toHaveValue("Waiting for a maintainer")
    await userEvent.type(notes, " · continuing after save")
    await expect(notes).toHaveValue(
      "First investigation · continuing after save",
    )
    await expect(
      screen.getByRole("button", { name: "Save notes" }),
    ).toBeEnabled()
  },
}

export const ConflictRefreshPreservesDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Star Chart" }),
    )
    const screen = within(canvasElement.ownerDocument.body)
    const notes = await screen.findByLabelText("Investigation notes")
    await userEvent.type(notes, "My unsaved investigation")
    // Another moderator changes the shared notes while this editor is open.
    cases[0].notes = "Another moderator's investigation"
    cases[0].version += 1
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }))
    await screen.findByText("Could not save")
    failNextRefresh = true
    await userEvent.click(screen.getByRole("button", { name: "Refresh case" }))
    await screen.findByText("Could not load this case")
    await expect(notes).toBeInTheDocument()
    await expect(notes).toHaveValue("My unsaved investigation")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    await screen.findByText("Shared notes changed")
    await expect(screen.getByLabelText("Investigation notes")).toBe(notes)
    await expect(notes).toHaveValue("My unsaved investigation")
    await expect(
      screen.getByText("Another moderator's investigation"),
    ).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }))
    await waitFor(() => expect(cases[0].notes).toBe("My unsaved investigation"))
    await waitFor(() =>
      expect(
        screen.queryByText("Shared notes changed"),
      ).not.toBeInTheDocument(),
    )
    await expect(notes).toHaveValue("My unsaved investigation")
  },
}

export const ErrorState: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/admin/maintenance", () =>
          HttpResponse.json(
            { detail: "Maintenance evidence is temporarily unavailable." },
            { status: 503 },
          ),
        ),
      ],
    },
  },
}
