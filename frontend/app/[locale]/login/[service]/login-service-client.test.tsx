// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import LoginServiceClient from "./login-service-client"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mutation: vi.fn<(options: { onSuccess: () => void }) => object>(() => ({})),
}))
vi.mock("@tanstack/react-query", () => ({ useMutation: mocks.mutation }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("src/i18n/navigation", () => ({
  usePathname: () => "/login/github",
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({}),
  useUserDispatch: () => vi.fn(),
}))
vi.mock("src/hooks/usePendingTransaction", () => ({
  usePendingTransaction: () => [null],
}))
vi.mock("src/asyncs/login", () => ({ login: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.removeItem("returnTo")
  vi.unstubAllEnvs()
  mocks.push.mockClear()
})

function resumeOAuth(returnTo: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_BASE_URI", location.origin)
  localStorage.setItem("returnTo", JSON.stringify(returnTo))
  renderToStaticMarkup(<LoginServiceClient services={["github"]} />)
  mocks.mutation.mock.lastCall![0].onSuccess()
}

it.each([
  [
    "/apps/org.example.App/translate?language=de%26other%3D1",
    "/apps/org.example.App/translate?language=de%26other%3D1",
  ],
  ["//other.example/path", "/"],
])("resumes OAuth with the validated destination %s", (returnTo, expected) => {
  resumeOAuth(returnTo)
  expect(mocks.push).toHaveBeenLastCalledWith(expected, { locale: undefined })
})

it("resumes OIDC with a full-page navigation that preserves encoded state", () => {
  const assign = vi.fn()
  vi.stubGlobal("window", { location: { ...location, assign }, localStorage })
  const returnTo = "/api/v2/oidc/authorize?client_id=reader&state=a%26b%3Dc"
  resumeOAuth(returnTo)
  expect(assign).toHaveBeenCalledExactlyOnceWith(returnTo)
  expect(mocks.push).not.toHaveBeenCalled()
})

it("rejects an OIDC return on the same host with a different scheme", () => {
  const assign = vi.fn()
  vi.stubGlobal("location", new URL("https://flathub.example"))
  vi.stubGlobal("window", { location: { ...location, assign }, localStorage })
  resumeOAuth("http://flathub.example/api/v2/oidc/authorize")
  expect(assign).not.toHaveBeenCalled()
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/", { locale: undefined })
})
