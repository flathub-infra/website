// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import axios from "axios"
import { NextIntlClientProvider } from "next-intl"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import messages from "../../../../public/locales/en/common.json"
import AppVerificationSetup from "./AppVerificationSetup"

const useUserContext = vi.hoisted(() => vi.fn())
vi.mock("src/context/user-info", () => ({ useUserContext }))
vi.mock("./LoginVerification", () => ({ default: () => null }))
vi.mock("./DnsVerification", () => ({ default: () => null }))
vi.mock("./WebsiteVerification", () => ({ default: () => null }))
vi.mock("../../ConfirmDialog", () => ({
  default: ({
    isVisible,
    onConfirmed,
  }: {
    isVisible: boolean
    onConfirmed: () => void
  }) => (isVisible ? <button onClick={onConfirmed}>Confirm</button> : null),
}))

const app = { id: "org.example.App" }
const path = `/verification/${app.id}`
const dns = { verified: true, method: "dns", website: "example.org" }
const none = { verified: false, method: "none" }
let cleanup: () => Promise<void>
afterEach(async () => {
  await cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderSetup(
  status: typeof dns | typeof none,
  canUnverify: () => boolean,
  methodsError?: string | (() => string | undefined),
  admin = false,
) {
  useUserContext.mockReturnValue({
    info: {
      invite_code: "account",
      dev_flatpaks: methodsError === "not_app_developer" ? [] : [app.id],
      permissions: admin ? ["modify-users"] : [],
    },
  })
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const get = vi.spyOn(axios, "get").mockImplementation(async (url) => {
    if (url === `${path}/status`) {
      return { data: status }
    }
    if (url === `${path}/can-unverify`) {
      return { data: canUnverify() }
    }
    if (url === `${path}/available-methods`) {
      const detail =
        typeof methodsError === "function" ? methodsError() : methodsError
      if (detail) {
        throw { response: { data: { detail } } }
      }
      return { data: { methods: [] } }
    }
    throw Error(`Unexpected request: ${url}`)
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const host = document.createElement("div")
  const root = createRoot(host)
  cleanup = async () => {
    await act(async () => root.unmount())
    client.clear()
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <AppVerificationSetup app={app} isNewApp={false} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  )
  const button = (label: string) =>
    Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === label,
    )
  return { host, button, get }
}

it.each([
  [true, true, undefined],
  [true, false, undefined],
  [false, true, "app_already_verified"],
  [false, false, "app_already_verified"],
  [false, true, "not_app_developer"],
  [false, true, "blocked_by_admins"],
] as const)(
  "public verified=%s, can unverify=%s, methods error=%s",
  async (verified, allowed, detail) => {
    const { host, button } = await renderSetup(
      verified ? dns : none,
      () => allowed,
      detail,
      detail === "not_app_developer" || detail === "blocked_by_admins",
    )
    await vi.waitFor(() => {
      expect(host.textContent).toContain(
        verified
          ? "example.org"
          : detail === "app_already_verified"
            ? messages.verified
            : detail === "not_app_developer"
              ? messages["app-is-currently-not-verified"]
              : detail,
      )
      expect(!!button("Unverify")).toBe(allowed)
      if (detail === "blocked_by_admins") {
        expect(button("Mark as manually verified")?.disabled).toBe(false)
      }
    })
  },
)

it("refreshes status and removes the denied action when confirmation loses authorization", async () => {
  let allowed = true
  const post = vi.spyOn(axios, "post").mockImplementation(async () => {
    allowed = false
    throw { response: { status: 403 } }
  })
  const { host, button, get } = await renderSetup(dns, () => allowed)
  await vi.waitFor(() => expect(button("Unverify")).toBeDefined())
  get.mockClear()
  await act(async () => button("Unverify")!.click())
  await act(async () => button("Confirm")!.click())
  await vi.waitFor(() => {
    expect(host.querySelector("[role=alert]")?.textContent).toBe(
      messages["unverify-failed"],
    )
    expect(button("Unverify")).toBeUndefined()
  })
  expect(post.mock.calls[0][0]).toBe(`${path}/unverify`)
  expect(get.mock.calls.map(([url]) => url)).toContain(`${path}/status`)
})

it("offers revocation after manual verification even before public status catches up", async () => {
  let allowed = false
  vi.spyOn(axios, "post").mockImplementation(async () => {
    allowed = true
    return { data: {} }
  })
  const { button } = await renderSetup(
    none,
    () => allowed,
    () => (allowed ? "app_already_verified" : undefined),
    true,
  )
  await vi.waitFor(() =>
    expect(button("Mark as manually verified")?.disabled).toBe(false),
  )
  await act(async () => button("Mark as manually verified")!.click())
  await vi.waitFor(() => {
    expect(button("Unverify")).toBeDefined()
    expect(button("Mark as manually verified")?.disabled).toBe(true)
  })
})

it("clears the methods error after an administrator removes a verification block", async () => {
  let blocked = true
  vi.spyOn(axios, "post").mockImplementation(async () => {
    blocked = false
    return { data: {} }
  })
  const { host, button } = await renderSetup(
    none,
    () => blocked,
    () => (blocked ? "blocked_by_admins" : undefined),
    true,
  )
  await vi.waitFor(() =>
    expect(host.textContent).toContain("blocked_by_admins"),
  )
  await act(async () => button("Unverify")!.click())
  await act(async () => button("Confirm")!.click())
  await vi.waitFor(() => {
    expect(host.textContent).toContain(messages["verification-warning"])
    expect(host.querySelector("[role=alert]")).toBeNull()
    expect(button("Unverify")).toBeUndefined()
  })
})
