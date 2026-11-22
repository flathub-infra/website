// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import AppVerificationSetup from "./AppVerificationSetup"

const mocks = vi.hoisted(() => ({
  user: { permissions: [] as string[], dev_flatpaks: [] as string[] },
  status: { verified: false, method: "none" } as
    { verified: boolean; method: string } | undefined,
  refreshStatus: vi.fn(),
  statusError: null as Error | null,
  methods: vi.fn(
    (
      _id: string,
      _params: { new_app: boolean },
      _options: { query: { enabled: boolean } },
    ): { data?: object; error?: object; refetch?: () => void } => ({
      data: { data: { methods: [{ method: "website" }] } },
    }),
  ),
}))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({ info: mocks.user }),
}))
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.status && { data: mocks.status },
    error: mocks.statusError,
    refetch: mocks.refreshStatus,
  }),
}))
vi.mock("src/codegen", () => ({
  useGetAvailableMethodsVerificationAppIdAvailableMethodsGet: mocks.methods,
  useManualVerificationVerificationAppIdManualVerificationPost: () => ({}),
}))
vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { rich: (key: string) => key }),
}))
vi.mock("./WebsiteVerification", () => ({
  default: () => <button>Website</button>,
}))
vi.mock("./LoginVerification", () => ({ default: () => null }))
vi.mock("./DnsVerification", () => ({ default: () => null }))

const app = { id: "org.example.App" }

const users = {
  manager: { permissions: ["manage-apps"], dev_flatpaks: [] },
  administrator: {
    permissions: ["manage-apps", "modify-users"],
    dev_flatpaks: [],
  },
  developer: { permissions: [], dev_flatpaks: [app.id] },
  publisher: { permissions: [], dev_flatpaks: [] },
}

function render(user: keyof typeof users, method = "none", isNewApp = false) {
  mocks.user = users[user]
  mocks.status = { verified: method !== "none", method }
  return renderToStaticMarkup(
    <AppVerificationSetup app={app} isNewApp={isNewApp} />,
  )
}

it.each([
  { role: "manager", methods: false, manual: false },
  { role: "administrator", methods: false, manual: true },
  { role: "developer", methods: true, manual: false },
  { role: "publisher", methods: true, manual: false },
] as const)(
  "shows unverified status and permitted actions for a $role",
  ({ role, methods, manual }) => {
    const html = render(role, "none", role === "publisher")
    expect(html).toContain("app-is-currently-not-verified")
    expect(mocks.methods.mock.lastCall![2].query.enabled).toBe(methods)
    expect(html.includes(">Website<")).toBe(methods)
    expect(html.includes("Mark as manually verified")).toBe(manual)
  },
)

it.each([
  { role: "manager", method: "website", unverify: false },
  { role: "administrator", method: "manual", unverify: true },
  { role: "developer", method: "manual", unverify: false },
  { role: "developer", method: "website", unverify: true },
] as const)(
  "shows verified $method status with unverify=$unverify for $role",
  ({ role, method, unverify }) => {
    const html = render(role, method)
    expect(html).toContain("app-is-currently-verified")
    expect(html.includes(">unverify<")).toBe(unverify)
  },
)

it("keeps status visible when verification methods fail to load", () => {
  mocks.methods.mockReturnValueOnce({ error: { message: "Network Error" } })
  const html = render("developer")
  expect(html).toContain("app-is-currently-not-verified")
  expect(html).toContain("Network Error")
})

it("keeps new-app verification methods but not existing-app manual verification for administrators", () => {
  const html = render("administrator", "none", true)
  expect(html).toContain(">Website<")
  expect(html).not.toContain("Mark as manually verified")
})

it("preserves the reported verification and retry after a failed status refresh", () => {
  mocks.statusError = new Error("Refresh failed")
  mocks.methods.mockReturnValueOnce({
    error: { response: { data: { detail: "app_already_verified" } } },
  })
  try {
    const html = render("developer")
    expect(html).toContain("Refresh failed")
    expect(html).toContain(">verified<")
    expect(html).toContain(">refresh<")
    expect(html).not.toContain("app-is-currently-not-verified")
  } finally {
    mocks.statusError = null
  }
})

it("keeps the verification heading on initial failure, and cached status without Unverify on refresh failure", () => {
  mocks.statusError = new Error("Status unavailable")
  try {
    mocks.status = undefined
    mocks.user = users.administrator
    const html = renderToStaticMarkup(
      <AppVerificationSetup app={app} isNewApp={false} />,
    )
    expect(html).toContain(">verification</h2>")
    expect(html).toContain("Status unavailable")
    const cached = render("administrator", "manual")
    expect(cached).toContain("app-is-currently-verified-manually")
    expect(cached).not.toContain(">unverify<")
  } finally {
    mocks.statusError = null
  }
})

it.each([false, true])(
  "refreshes conflicting verification results when the latest status is verified=%s",
  async (verified) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    const retryMethods = vi.fn()
    mocks.user = users.developer
    mocks.status = { verified: false, method: "none" }
    mocks.refreshStatus.mockResolvedValueOnce({
      isSuccess: true,
      data: { data: { verified } },
    })
    mocks.methods.mockReturnValueOnce({
      error: { response: { data: { detail: "app_already_verified" } } },
      refetch: retryMethods,
    })
    const host = document.createElement("div")
    const root = createRoot(host)
    try {
      await act(async () =>
        root.render(<AppVerificationSetup app={app} isNewApp={false} />),
      )
      expect(host.querySelector("p")?.textContent).toBe("verified")
      const button = host.querySelector("button")
      expect(button?.textContent).toBe("refresh")
      expect(host.textContent).not.toContain("unverify")
      await act(async () => button!.click())
      expect(mocks.refreshStatus).toHaveBeenCalled()
      expect(retryMethods).toHaveBeenCalledTimes(verified ? 0 : 1)
    } finally {
      await act(async () => root.unmount())
      vi.unstubAllGlobals()
    }
  },
)
