// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import axios from "axios"
import { afterEach, expect, it, vi } from "vitest"
import { AppHeader } from "./AppHeader"

vi.mock("../LogoImage", () => ({ default: () => null }))
vi.mock("./Verification", () => ({ default: () => null }))
vi.mock("../application/InstallButton", () => ({ default: () => null }))
const user = vi.hoisted(() => ({
  info: {} as object | undefined,
  loading: false,
}))
vi.mock("src/context/user-info", () => ({ useUserContext: () => user }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: String }),
}))
vi.mock("src/i18n/navigation", () => ({ Link: "a" }))
vi.mock("@mitresthen/matomo-tracker-react", () => ({ useMatomo: () => ({}) }))

const path = "/favorites/org.example.App"
let cleanup: () => Promise<void>
afterEach(async () => {
  await cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderHeader(signedIn: boolean) {
  user.info = signedIn ? {} : undefined
  const client = new QueryClient()
  const host = document.createElement("div")
  const root = createRoot(host)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  cleanup = async () => {
    await act(async () => root.unmount())
    client.clear()
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AppHeader
          app={{
            id: "org.example.App",
            name: "Example",
            type: "desktop-application",
            summary: "",
            description: "",
            releases: [],
            bundle: { type: "flatpak", value: "org.example.App" },
            is_free_license: true,
          }}
          vendingSetup={undefined}
          verificationStatus={{ verified: false, method: "none" }}
          isQualityModalOpen={false}
        />
      </QueryClientProvider>,
    ),
  )
  return host
}

it("shows the public count and returns signed-out visitors to the app after login", async () => {
  const get = vi
    .spyOn(axios, "get")
    .mockResolvedValue({ data: { favorites_count: 42 } })
  const host = await renderHeader(false)
  const link = host.querySelector("a")!
  await vi.waitFor(() => expect(link.textContent).toBe("42"))
  expect(link.getAttribute("aria-label")).toBe("login-to-bookmark")
  const href = new URL(link.href)
  expect(href.pathname).toBe("/login")
  expect(href.searchParams.get("returnTo")).toBe("/apps/org.example.App")
  expect(get.mock.calls.map(([url]) => url)).toEqual([`${path}/count`])
})

it("keeps the committed bookmark count when an older read finishes last", async () => {
  const stale = Promise.withResolvers<{ data: { favorites_count: number } }>()
  let countReads = 0
  const otherBookmarks = 5
  let bookmarked = false
  vi.spyOn(axios, "get").mockImplementation(async (url) => {
    if (url === path) {
      return { data: bookmarked }
    }
    if (url !== `${path}/count/current`) {
      throw new Error(`Unexpected request: ${url}`)
    }
    return countReads++ === 0
      ? stale.promise
      : { data: { favorites_count: otherBookmarks + Number(bookmarked) } }
  })
  vi.spyOn(axios, "post").mockImplementation(async () => {
    bookmarked = true
    return { data: null }
  })
  vi.spyOn(axios, "delete").mockImplementation(async () => {
    bookmarked = false
    return { data: null }
  })
  const host = await renderHeader(true)
  const button = host.querySelector<HTMLButtonElement>("button[aria-pressed]")!
  await vi.waitFor(() => expect(button.disabled).toBe(false))
  await act(async () => button.click())
  await act(async () => stale.resolve({ data: { favorites_count: 5 } }))
  await vi.waitFor(() => expect(button.textContent).toBe("6"))
  expect(button.getAttribute("aria-pressed")).toBe("true")
  await act(async () => button.click())
  await vi.waitFor(() => expect(button.textContent).toBe("5"))
  expect(button.getAttribute("aria-pressed")).toBe("false")
})
