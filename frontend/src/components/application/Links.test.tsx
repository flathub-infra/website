import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { expect, it, vi } from "vitest"
import messages from "../../../public/locales/en/common.json"
import Links from "./Links"

vi.mock("@mitresthen/matomo-tracker-react", () => ({
  useMatomo: () => ({ trackEvent: vi.fn() }),
}))

it("keeps repository fallbacks and accepts mail links only for contact", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Links
        app={{
          id: "org.example.App",
          metadata: {
            "flathub::verification::verified": true,
            "flathub::manifest": "ftp://example.org/manifest",
          },
          urls: {
            bugtracker: "/issues",
            contact: "mailto:contact@example.org",
            homepage: "mailto:homepage@example.org",
          },
        }}
      />
    </NextIntlClientProvider>,
  )
  expect(html).toContain('href="https://github.com/flathub/org.example.App"')
  expect(html).toContain(
    'href="https://github.com/flathub/org.example.App/issues"',
  )
  expect(html).toContain('href="mailto:contact@example.org"')
  expect(html).not.toContain("mailto:homepage@example.org")
})
