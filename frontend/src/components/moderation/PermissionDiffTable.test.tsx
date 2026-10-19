import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import messages from "../../../public/locales/en/common.json"
import PermissionDiffTable from "./PermissionDiffTable"

const render = (children: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>,
  )

test("groups changes by architecture with labelled before and after columns", () => {
  const html = render(
    <PermissionDiffTable
      source="baseline"
      differences={[
        {
          path: ["x86_64", "Context", "sockets"],
          before: ["x11"],
          after: ["wayland"],
        },
        {
          path: ["aarch64", "Context", "filesystems"],
          before: null,
          after: ["home"],
        },
      ]}
    />,
  )
  expect(html.match(/<table /g)).toHaveLength(2)
  expect(html).toContain("x86_64")
  expect(html).toContain("aarch64")
  expect(html).toContain('scope="row"')
  expect(html).toContain('data-diff="old-value"')
  expect(html).toContain('data-diff="new-value"')
  expect(html).toContain("Context / sockets")
  expect(html).toContain("wayland")
  expect(html).toContain("—")
  expect(html).toContain("1 changed permission")
})

test("retains the snapshot fallback when there is no comparison source", () => {
  const html = render(
    <PermissionDiffTable snapshot={{ x86_64: { sockets: ["wayland"] } }} />,
  )
  expect(html).toContain("<pre")
  expect(html).toContain("wayland")
  expect(html).not.toContain("<table")
})

test("uses the plural translation for multiple changed permissions", () => {
  const html = render(
    <PermissionDiffTable
      source="baseline"
      differences={[
        {
          path: ["x86_64", "Context", "sockets"],
          before: null,
          after: ["wayland"],
        },
        {
          path: ["x86_64", "Context", "filesystems"],
          before: null,
          after: ["home"],
        },
      ]}
    />,
  )
  expect(html).toContain("2 changed permissions")
})
