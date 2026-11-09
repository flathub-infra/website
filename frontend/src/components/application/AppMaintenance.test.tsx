import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import messages from "../../../public/locales/en/common.json"
import AppMaintenance from "./AppMaintenance"

const query = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: {
    data: {
      metadata: {
        runtime: "org.gnome.Platform/x86_64/48",
        runtimeIsEol: undefined as boolean | undefined,
      },
    },
  },
}))
vi.mock("src/codegen/app/app", () => ({
  useGetSummarySummaryAppIdGet: () => query,
}))
vi.mock("src/i18n/navigation", () => ({ Link: "a" }))
const user = vi.hoisted(() => ({
  info: undefined as { permissions: string[] } | undefined,
}))
vi.mock("src/context/user-info", () => ({ useUserContext: () => user }))
const checkerQuery = vi.hoisted(() => vi.fn(() => ({ isPending: true })))
vi.mock("src/codegen/checker-health/checker-health", () => ({
  useGetCheckerHealthAppsAppIdCheckerHealthGet: checkerQuery,
}))

function render(manifestUrl?: string | null) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <AppMaintenance appId="org.example.App" manifestUrl={manifestUrl} />
    </NextIntlClientProvider>,
  )
}

describe("maintainer evidence", () => {
  it.each([
    { permissions: undefined },
    { permissions: [] },
    { permissions: ["moderation"] },
  ])(
    "hides checker health and avoids requests without admin permission: %s",
    ({ permissions }) => {
      user.info = permissions ? { permissions } : undefined
      checkerQuery.mockClear()
      expect(render()).not.toContain("Update check health")
      expect(checkerQuery).not.toHaveBeenCalled()
    },
  )

  it("shows checker health for admins", () => {
    user.info = { permissions: ["modify-users"] }
    expect(render()).toContain("Update check health")
    expect(checkerQuery).toHaveBeenCalled()
    user.info = undefined
  })

  it.each([null, undefined])(
    "uses the app detail fallback when manifest metadata is %s",
    (manifest) => {
      expect(render(manifest)).toContain(
        'href="https://github.com/flathub/org.example.App"',
      )
    },
  )

  it("preserves empty manifest metadata like the app detail page", () => {
    expect(render("")).toContain('href=""')
    expect(render("")).not.toContain(
      'href="https://github.com/flathub/org.example.App"',
    )
  })

  it("prefers an explicit packaging location over the default repository", () => {
    expect(render("https://example.org/manifest.json")).toContain(
      'href="https://example.org/manifest.json"',
    )
  })
  it.each([false, undefined])(
    "does not claim support from an EOL flag of %s",
    (flag) => {
      query.data.data.metadata.runtimeIsEol = flag
      const html = render()
      expect(html).not.toContain("This runtime is end of life")
      expect(html).toContain("org.gnome.Platform/x86_64/48")
      expect(html).not.toContain("supported")
      expect(html).toContain("/builds/apps/org.example.App")
    },
  )

  it("shows an explicit EOL warning and supplied manifest link", () => {
    query.data.data.metadata.runtimeIsEol = true
    const html = render("https://example.org/manifest.json")
    expect(html).toContain("This runtime is end of life")
    expect(html).toContain('href="https://example.org/manifest.json"')
  })

  it("does not show cached runtime evidence as current when fetching fails", () => {
    query.isError = true
    const html = render()
    expect(html).toContain("Runtime information is unavailable.")
    expect(html).not.toContain("This runtime is end of life")
    expect(html).toContain("View build results")
    query.isError = false
  })
})
