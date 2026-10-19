import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { MaintenanceCase, MaintenanceDashboard } from "src/codegen/model"
import { CaseEditor, RadarQueue } from "./maintenance-client"
import { createCaseDraft } from "./case-drafts"

// The queue itself does not navigate; keep Next's runtime out of these render tests.
vi.mock("src/i18n/navigation", () => ({
  Link: "a",
  usePathname: () => "/admin/maintenance",
  useRouter: () => ({ push() {}, replace() {} }),
}))

const app: MaintenanceCase = {
  app_id: "org.example.Clock",
  name: "Example Clock",
  last_updated_at: null,
  days_since_update: null,
  installs_last_7_days: 15,
  runtime: null,
  runtime_eol: null,
  signals: [
    {
      kind: "unknown",
      severity: "low",
      confidence: "unknown",
      evidence: "No package-update timestamp is available.",
      next_step: "Check repository history.",
    },
  ],
  fingerprint: "test",
  owner_id: null,
  owner_name: null,
  owned_by_me: false,
  notes: "",
  snoozed_until: null,
  snooze_reason: "",
  snoozed: false,
  reopened: false,
  version: 0,
}

function render(cases: MaintenanceCase[], draftAppIds?: ReadonlySet<string>) {
  const data: MaintenanceDashboard = {
    cases,
    total: cases.length,
    page: 1,
    page_size: 25,
    active: cases.length,
    snoozed: 0,
    campaigns: [],
    evaluated_at: "2026-10-13T12:00:00",
  }
  return renderToStaticMarkup(
    <RadarQueue data={data} onSelect={() => {}} draftAppIds={draftAppIds} />,
  )
}

describe("maintenance action queue", () => {
  it("labels upstream evidence without declaring the app outdated", () => {
    const html = render([
      {
        ...app,
        signals: [
          { ...app.signals[0], kind: "upstream", confidence: "investigate" },
        ],
      },
    ])
    expect(html).toContain("Newer upstream release")
    expect(html).not.toContain("Outdated")
  })
  it("labels missing activity as unknown, not abandonment", () => {
    const html = render([app])
    expect(html).toContain("Unknown activity")
    expect(html).toContain("Updated")
    expect(html).toContain(">Unknown</td>")
    expect(html).not.toContain("days ago")
  })

  it("shows shared ownership and reopened evidence", () => {
    const html = render([
      { ...app, owner_id: 42, owner_name: "Moderator", reopened: true },
    ])
    expect(html).toContain("Moderator")
    expect(html).toContain("Reopened")
  })

  it("offers a filter reset without claiming catalog health", () => {
    const html = render([])
    expect(html).toContain("No cases in this queue")
    expect(html).toContain("Try another filter or search")
    expect(html).not.toContain("healthy")
  })

  it("keeps the queue compact and leaves detailed evidence in the dialog", () => {
    const html = render([app])
    expect(html).toContain('aria-label="Maintenance cases"')
    expect(html).toContain("Downloads / 7d")
    expect(html).not.toContain(app.signals[0].evidence)
    expect(html).not.toContain("Investigate")
    expect(html).not.toContain('data-slot="card"')
  })

  it("identifies cases assigned to the current moderator", () => {
    const html = render([{ ...app, owner_id: 42, owned_by_me: true }])
    expect(html).toContain("Assigned to you")
  })

  it("marks cases with retained drafts", () => {
    expect(render([app], new Set([app.app_id]))).toContain(">Draft<")
    expect(render([app])).not.toContain(">Draft<")
  })

  it("escapes app metadata instead of rendering it as HTML", () => {
    const html = render([{ ...app, name: "<script>alert(1)</script>" }])
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>alert")
  })
})

describe("maintenance case editor", () => {
  function renderCase(value: MaintenanceCase) {
    return renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <CaseEditor
          app={value}
          staleDays={365}
          draft={createCaseDraft(value.notes)}
          dispatchDrafts={() => {}}
        />
      </QueryClientProvider>,
    )
  }

  it("keeps evidence and snooze details collapsed while notes stay visible", () => {
    const html = renderCase(app)
    expect(html).toContain('aria-label="Case evidence"')
    expect(html).toContain("Investigation notes")
    expect(html).toContain("Shared with moderators")
    expect(html.indexOf(app.signals[0].next_step)).toBeLessThan(
      html.indexOf("<details"),
    )
    const disclosures = html.match(/<details\b[^>]*>/g)
    expect(disclosures).toHaveLength(2)
    expect(disclosures?.every((tag) => !tag.includes(" open"))).toBe(true)
    expect(html).not.toContain("Package age alone")
  })

  it("shows the existing snooze and wake action instead of a new snooze form", () => {
    const html = renderCase({
      ...app,
      snoozed: true,
      snoozed_until: "2026-11-01T12:00:00",
      snooze_reason: "Waiting for a response",
    })
    expect(html).toContain("Snoozed until")
    expect(html).toContain("Waiting for a response")
    expect(html).toContain("Return to active queue")
    expect(html).not.toContain('id="maintenance-reason"')
  })

  it("shows upstream provenance, versions and freshness even when evidence is stale", () => {
    const html = renderCase({
      ...app,
      upstream: {
        project_id: 12,
        project_url: "https://release-monitoring.org/project/12/",
        packaged_version: "1.0",
        upstream_version: "2.0",
        status: "stale",
        checked_at: "2026-10-13T12:00:00",
        last_attempt_at: "2026-10-19T12:00:00",
      },
    })
    expect(html).toContain('href="https://release-monitoring.org/project/12/"')
    expect(html).toContain("Packaged: 1.0")
    expect(html).toContain("upstream: 2.0")
    expect(html).toContain("Last successful check:")
    expect(html).toContain("Last attempt:")
    expect(html).toContain("Unknown or stale evidence does not establish")
  })
})
