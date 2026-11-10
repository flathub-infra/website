import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CheckerHealth as Health } from "src/codegen/model"
import CheckerHealth from "./CheckerHealth"
import { checkerSource } from "./CheckerHealth.fixtures"

const query = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: { data: {} as Health },
}))
vi.mock("src/codegen/checker-health/checker-health", () => ({
  useGetCheckerHealthAppsAppIdCheckerHealthGet: () => query,
}))

function render(locale = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
      <CheckerHealth appId="org.example.App" />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  query.isPending = false
  query.isError = false
  query.data.data = {}
})

describe("checker health evidence", () => {
  it.each([[null], ["branch/25.08", "branch/26.08"]])(
    "groups sources and deduplicates shared manifests for %j",
    (...branches) => {
      query.data.data = {
        last_report_at: "2026-11-08T17:45:00Z",
        sources: branches.flatMap((branch) =>
          ["node", "yarn"].map((module, index) => ({
            branch,
            source: checkerSource({
              module,
              manifest: "shared-manifest.yaml",
              source_pointer: `/${index}`,
            }),
            observed_at: "2026-11-08T17:45:00Z",
            run_url: "https://github.com/flathub/flathub/actions/runs/123",
          })),
        ),
      }
      const html = render()
      expect(html.match(/shared-manifest.yaml/g)).toHaveLength(branches.length)
      expect(html.match(/<h5 /g)).toHaveLength(branches.length)
      expect(html).toContain(`${branches.length * 2} sources`)
      expect(html).not.toContain(`of ${branches.length * 2} sources`)
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain("Observed Nov 8, 2026, 5:45 PM")
      expect(html.match(/Observed Nov 8, 2026, 5:45 PM/g)).toHaveLength(
        branches.length,
      )
    },
  )

  it("keeps individual manifest paths when a branch contains different manifests", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: ["first.yaml", "second.yaml"].map((manifest) => ({
        branch: null,
        source: checkerSource({ module: "node", manifest }),
        observed_at: "2026-11-08T17:45:00Z",
        run_url: "https://github.com/flathub/flathub/actions/runs/123",
      })),
    }
    const html = render()
    expect(html).toContain("first.yaml")
    expect(html).toContain("second.yaml")
    expect(html.match(/<h5 /g)).toHaveLength(1)
  })

  it("keeps per-source dates when a later page has an older observation", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: Array.from({ length: 11 }, (_, index) => ({
        branch: null,
        source: checkerSource({
          module: `source-${index}`,
          manifest: "app.yaml",
          source_pointer: `/${index}`,
        }),
        observed_at:
          index === 10 ? "2026-11-07T17:45:00Z" : "2026-11-08T17:45:00Z",
        run_url: "https://github.com/flathub/flathub/actions/runs/123",
      })),
    }
    const html = render()
    expect(html.match(/Observed Nov 8, 2026, 5:45 PM/g)).toHaveLength(10)
    expect(html).not.toContain(">source-10<")
  })

  it("keeps a later branch's failure visible ahead of paginated checked sources", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: Array.from({ length: 12 }, (_, index) => ({
        branch: index === 11 ? "branch/26.08" : "branch/25.08",
        source: checkerSource({
          module: index === 11 ? "failed-source" : `checked-${index}`,
          manifest: "app.yaml",
          source_pointer: `/${index}`,
          status: index === 11 ? "failed" : "checked",
        }),
        observed_at: "2026-11-08T17:45:00Z",
        run_url: "https://github.com/flathub/flathub/actions/runs/123",
      })),
    }
    const html = render()
    expect(html.indexOf("branch/26.08")).toBeLessThan(
      html.indexOf("branch/25.08"),
    )
    expect(html).toContain("failed-source")
    expect(html).toContain("10 of 12 sources")
    expect(html).not.toContain(">checked-9<")
  })

  it("uses English admin copy without a translation catalog", () => {
    expect(render("de")).toContain("Update check health")
    expect(render("de")).toContain("No update check report")
  })
  it("distinguishes unknown, loading and unavailable without claiming success", () => {
    expect(render()).toContain("No update check report")
    query.isPending = true
    expect(render()).toContain("Loading update check health")
    query.isPending = false
    query.isError = true
    query.data.data.last_report_at = "2026-11-08T17:45:00Z"
    expect(render()).toContain("Reload reports")
    expect(render()).toContain("does not mean the update checker failed")
    expect(render()).not.toContain("Last report</dt>")
  })

  it("shows unresolved failures independently of an unchecked latest observation", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: [
        {
          branch: "branch/24.08",
          source: checkerSource({
            manifest: "app.yml",
            source_pointer: "/modules/0/sources/0",
            status: "unchecked",
          }),
          observed_at: "2026-11-07T17:45:00Z",
          run_url: "https://github.com/flathub/flathub/actions/runs/123",
          failures: 3,
          last_failure_at: "2026-11-06T17:45:00Z",
          last_failure_run_url:
            "https://github.com/flathub/flathub/actions/runs/122/attempts/1",
          failure_errors: [
            { type: "HTTPError", message: "<script>alert(1)</script>" },
          ],
        },
      ],
    }
    const html = render()
    expect(html).toContain("Failed on 3 observed checks")
    expect(html).toContain("1 source has an unresolved failure")
    expect(html).not.toContain("No unresolved source failures")
    expect(html).toContain("branch/24.08")
    expect(html).toContain("app.yml<br/>/modules/0/sources/0")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain(
      'href="https://github.com/flathub/flathub/actions/runs/123"',
    )
    expect(html).not.toContain("Checker recovered on")
    expect(html).toContain(
      'href="https://github.com/flathub/flathub/actions/runs/122/attempts/1"',
    )
  })

  it("keeps policy blocks separate from historical recovery and explains uncertain file errors", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: [
        {
          branch: null,
          source: checkerSource({
            manifest: "app.yml",
            source_pointer: "/0",
            status: "blocked",
          }),
          observed_at: "2026-11-08T17:45:00Z",
          run_url: "https://github.com/flathub/flathub/actions/runs/123",
          recovered_at: "2026-11-07T17:45:00Z",
        },
      ],
      diagnostics: [
        {
          branch: null,
          error: {
            type: "ManifestFileOpenError",
            message: "shared-modules/file.json",
          },
          first_seen_at: "2026-11-07T17:45:00Z",
          last_seen_at: "2026-11-08T17:45:00Z",
          run_url: "https://github.com/flathub/flathub/actions/runs/123",
          observations: 2,
        },
      ],
    }
    const html = render()
    expect(html).toContain("Policy-blocked update")
    expect(html).not.toContain(">Recovered<")
    expect(html).toContain("intentionally uninitialized submodules")
    expect(html).toContain("Seen in 2 reports")
    expect(html).toContain("existing open or closed pull request")
  })

  it("shows recovery only with a current positive result", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: [
        {
          branch: null,
          source: checkerSource({
            manifest: "app.yml",
            source_pointer: "/0",
            status: "checked",
          }),
          observed_at: "2026-11-08T17:45:00Z",
          run_url: "https://github.com/flathub/flathub/actions/runs/123",
          recovered_at: "2026-11-08T17:45:00Z",
        },
      ],
    }
    expect(render()).toContain(">Recovered<")
    expect(render()).toContain("No unresolved source failures")
    expect(render()).not.toContain("No source failures recorded")
    query.data.data.sources![0].source.status = "unchecked"
    expect(render()).not.toContain(">Recovered<")
  })

  it("keeps long dependency lists bounded and offers search and more results", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      sources: Array.from({ length: 150 }, (_, index) => ({
        branch: null,
        source: checkerSource({
          module: `dependency-${index}`,
          manifest: "generated.json",
          source_pointer: `/${index}`,
          status: "unchecked",
        }),
        observed_at: "2026-11-08T17:45:00Z",
        run_url: "https://github.com/flathub/flathub/actions/runs/123",
      })),
    }
    const html = render()
    expect(html).toContain("10 of 150 sources")
    expect(html).toContain("No unresolved source failures")
    expect(html).toContain("Missing or unchecked results remain unknown")
    expect(html).toContain("Find a source")
    expect(html).toContain("Show 20 more sources")
    expect(html).not.toContain(">dependency-10<")
  })

  it.each([
    [null, "Source location unknown"],
    ["", "Document root"],
  ])(
    "explains source pointer %s without conflating unknown and root",
    (source_pointer, label) => {
      query.data.data = {
        last_report_at: "2026-11-08T17:45:00Z",
        sources: [
          {
            branch: null,
            source: checkerSource({ source_pointer, status: "failed" }),
            observed_at: "2026-11-08T17:45:00Z",
            run_url: "https://github.com/flathub/flathub/actions/runs/123",
            failures: 1,
          },
        ],
      }
      expect(render()).toContain(label)
    },
  )

  it("preserves runtime skip reasons and replacement details in history", () => {
    query.data.data = {
      last_report_at: "2026-11-08T17:45:00Z",
      history: [
        {
          observed_at: "2026-11-08T17:45:00Z",
          run_url: "https://github.com/flathub/flathub/actions/runs/123",
          status: "completed",
          delivery: "no_changes",
          branches: [
            {
              branch: "branch/24.08",
              status: "skipped",
              skip_reason: "runtime-end-of-life",
              runtime_eol: [
                {
                  ref: "runtime/org.freedesktop.Platform/x86_64/24.08",
                  end_of_life: "Unsupported runtime",
                  end_of_life_rebase:
                    "runtime/org.freedesktop.Platform/x86_64/25.08",
                },
              ],
            },
          ],
        },
      ],
    }
    const html = render()
    expect(html).toContain("Skipped because a parent runtime is end of life")
    expect(html).toContain("Unsupported runtime")
    expect(html).toContain(
      "Replacement runtime: runtime/org.freedesktop.Platform/x86_64/25.08",
    )
    expect(html).not.toContain(">Recovered<")
  })
})
