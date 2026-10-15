import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { MaintenanceCase, MaintenanceDashboard } from "src/codegen/model"
import { RadarQueue } from "./maintenance-client"

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

function render(cases: MaintenanceCase[]) {
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
  return renderToStaticMarkup(<RadarQueue data={data} onSelect={() => {}} />)
}

describe("maintenance action queue", () => {
  it("labels missing activity as unknown, not abandonment", () => {
    const html = render([app])
    expect(html).toContain("Unknown activity")
    expect(html).toContain("Last package update: Unknown")
    expect(html).not.toContain("days ago")
  })

  it("shows shared ownership and reopened evidence", () => {
    const html = render([
      { ...app, owner_id: 42, owner_name: "Moderator", reopened: true },
    ])
    expect(html).toContain("Claimed · Moderator")
    expect(html).toContain("Review needed · reopened")
  })

  it("explains an empty queue without claiming catalog health", () => {
    const html = render([])
    expect(html).toContain("No cases in this queue")
    expect(html).toContain(
      "Missing evidence is never treated as proof of good health",
    )
  })

  it("escapes app metadata instead of rendering it as HTML", () => {
    const html = render([{ ...app, name: "<script>alert(1)</script>" }])
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>alert")
  })
})
