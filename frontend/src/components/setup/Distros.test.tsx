import { test, expect, vi } from "vitest"
import type { ReactNode, ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import common from "../../../public/locales/en/common.json"
import distros from "../../../public/locales/en/distros.json"
import { fetchSetupInstructions } from "../../distro-setup"
import DistroSetupClient from "../../../app/[locale]/setup/[distro]/distro-setup-client"
import { distroMap } from "./Distros"
import { CentOSStream } from "./Distros.stories"

vi.mock("src/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// Expose animation identity without needing a browser or running animations.
vi.mock("framer-motion", () => ({
  motion: {
    picture: ({
      layoutId,
      ...props
    }: ComponentProps<"picture"> & { layoutId: string }) => (
      <picture data-layout-id={layoutId} {...props} />
    ),
    h1: ({
      layoutId,
      children,
      ...props
    }: ComponentProps<"h1"> & { layoutId: string }) => (
      <h1 data-layout-id={layoutId} {...props}>
        {children}
      </h1>
    ),
  },
  LayoutGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const instructions = await fetchSetupInstructions()
const pages = distroMap("en")

function render(page: ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={{ ...common, distros }}
      onError={(error) => {
        throw error
      }}
    >
      {page}
    </NextIntlClientProvider>,
  )
}

test("every listed distro has a setup page", () => {
  expect(pages.size).toBe(instructions.length)
  for (const distro of instructions) {
    expect(pages.has(distro.name.replaceAll("/", "")), distro.name).toBe(true)
  }
})

for (const distro of instructions) {
  test(`renders ${distro.name} with valid HowTo URLs and undamaged text`, () => {
    const html = render(pages.get(distro.name.replaceAll("/", "")))
    const scripts = [
      ...html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
      ),
    ]
    const schemas = scripts
      .map((script) => JSON.parse(script[1]))
      .filter((schema) => schema["@type"] === "HowTo")
    const key = distro.translatedNameKey.split(".")[1]
    const messages = distros[key]
    const stepCount = Object.keys(messages).filter((key) =>
      key.startsWith("step-"),
    ).length
    expect(schemas.length).toBe(stepCount ? 1 : 0)
    for (const schema of schemas) {
      expect(schema.step.length).toBe(
        Object.keys(messages).filter((key) => key.startsWith("step-")).length,
      )
      for (const [index, step] of schema.step.entries()) {
        expect(step.url).toBe(
          `https://flathub.org/setup/${encodeURIComponent(distro.slug ?? distro.name)}`,
        )
        // next-seo escapes punctuation in JSON-LD string values.
        const text = step.itemListElement[0].text.replace(
          /&(quot|apos|amp|lt|gt);/g,
          (_, entity) =>
            ({ quot: '"', apos: "'", amp: "&", lt: "<", gt: ">" })[entity],
        )
        expect(text).toBe(
          messages[`step-${index + 1}`].text
            .replace(/<[^>]*>/g, "")
            .replace(/\s{2,}/g, " ")
            .trim(),
        )
      }
    }
  })
}

test("postmarketOS renders its built-in Flatpak introduction", () => {
  const html = render(pages.get("postmarketOS"))
  expect(html).toContain("Flatpak is installed by default on postmarketOS!")
  expect(html).toContain('href="/"')
})

test("CentOS Stream story renders the actual distro map entry", () => {
  const story = CentOSStream.render as () => ReactNode
  expect(render(story())).toContain("CentOS Stream")
})

test("Pisi breadcrumb uses the slash-free route alias", () => {
  const distro = instructions.find((distro) => distro.name === "Pisi GNU/Linux")
  const html = render(<DistroSetupClient distroData={distro} locale="en" />)
  expect(html).toContain('href="/setup/Pisi%20GNU%20Linux"')
  expect(html).not.toContain('href="/setup/Pisi%20GNU%2FLinux"')
})

test("T2 SDE animation identity matches the setup listing", () => {
  const html = render(pages.get("T2 SDE"))
  expect(html).toContain('data-layout-id="distro-logo-T2-SDE"')
  expect(html).toContain('data-layout-id="distro-name-T2-SDE"')
})
