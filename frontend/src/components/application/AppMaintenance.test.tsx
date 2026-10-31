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

function render(manifestUrl?: string) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AppMaintenance appId="org.example.App" manifestUrl={manifestUrl} />
    </NextIntlClientProvider>,
  )
}

describe("maintainer evidence", () => {
  it.each([false, undefined])(
    "does not claim support from an EOL flag of %s",
    (flag) => {
      query.data.data.metadata.runtimeIsEol = flag
      const html = render()
      expect(html).not.toContain("This runtime is end of life")
      expect(html).toContain("org.gnome.Platform/x86_64/48")
      expect(html).not.toContain("supported")
      expect(html).toContain("/builds/apps/org.example.App")
      expect(html).not.toContain("https://github.com/flathub/org.example.App")
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
    const html = render("javascript:alert(1)")
    expect(html).toContain("Runtime information is unavailable.")
    expect(html).not.toContain("This runtime is end of life")
    expect(html).not.toContain("javascript:")
    expect(html).toContain("View build results")
    query.isError = false
  })
})
