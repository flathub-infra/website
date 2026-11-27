// @vitest-environment jsdom
import axios, { type AxiosResponse } from "axios"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { UserInfoProvider, useUserContext, useUserDispatch } from "./user-info"

vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}))

function AccountStatus() {
  const user = useUserContext()
  return user.loading ? "Loading" : (user.info?.displayname ?? "Signed out")
}

function SignIn() {
  const dispatch = useUserDispatch()
  return (
    <button
      aria-label="Sign in"
      onClick={() =>
        dispatch({
          type: "login",
          info: {
            displayname: "New account",
            invite_code: "new",
            accepted_publisher_agreement_at: null,
            default_account: { login: "new" },
            auths: {},
          },
        })
      }
    />
  )
}

function RefreshApps() {
  const dispatch = useUserDispatch()
  return (
    <button
      aria-label="Refresh apps"
      onClick={() => dispatch({ type: "update-dev-flatpaks", devFlatpaks: [] })}
    />
  )
}

const host = document.createElement("div")
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function navigate(url: string, showSignIn = false) {
  history.pushState(null, "", url)
  return act(async () =>
    root.render(
      <UserInfoProvider>
        <AccountStatus />
        {showSignIn && <SignIn />}
        <RefreshApps />
      </UserInfoProvider>,
    ),
  )
}

it("renews on search-only navigation and signs out when the session expires", async () => {
  const get = vi.spyOn(axios, "get").mockResolvedValueOnce({
    status: 200,
    data: { displayname: "Flathub User", invite_code: "reader" },
  })
  const head = vi.spyOn(axios, "head").mockResolvedValue({
    status: 200,
    headers: { "flathub-account-invite-code": "reader" },
  })
  await navigate("/en")
  await navigate("/en/apps/search?q=music")
  expect(get).toHaveBeenCalledTimes(1)

  const renewal = Promise.withResolvers<AxiosResponse>()
  head.mockReturnValueOnce(renewal.promise)
  await navigate("/en/apps/search?q=video")
  expect(head).toHaveBeenCalledTimes(2)
  expect(head).toHaveBeenLastCalledWith("/auth/userinfo", {
    withCredentials: true,
    signal: expect.any(AbortSignal),
  })
  expect(host.textContent).toBe("Flathub User")

  await navigate("/en/apps/org.example.App")
  expect(head).toHaveBeenCalledTimes(3)
  await act(async () => renewal.resolve({ status: 204 } as AxiosResponse))
  expect(host.textContent).toBe("Flathub User")
  head.mockResolvedValueOnce({ status: 204 })
  await navigate("/en")
  expect(host.textContent).toBe("Signed out")
})

it("recognizes sign-in from another tab on the next navigation", async () => {
  const get = vi.spyOn(axios, "get").mockResolvedValue({ status: 204 })
  const head = vi.spyOn(axios, "head").mockResolvedValue({ status: 204 })
  await navigate("/en")
  await navigate("/en/apps/org.example.App")
  expect(get).toHaveBeenCalledTimes(1)
  expect(head).toHaveBeenCalledOnce()
  expect(host.textContent).toBe("Signed out")
  head.mockResolvedValueOnce({ status: 200 })
  get.mockResolvedValueOnce({ status: 200, data: { displayname: "Reader" } })
  await navigate("/en/apps/search?q=music")
  expect(host.textContent).toBe("Reader")
})

it("applies a cross-tab logout during an app list refresh", async () => {
  vi.spyOn(axios, "get").mockResolvedValueOnce({
    status: 200,
    data: { displayname: "Reader", invite_code: "reader" },
  })
  const renewal = Promise.withResolvers<AxiosResponse>()
  vi.spyOn(axios, "head").mockReturnValueOnce(renewal.promise)
  await navigate("/en")
  await navigate("/en/apps")
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('[aria-label="Refresh apps"]')!
      .click(),
  )
  await act(async () => renewal.resolve({ status: 204 } as AxiosResponse))
  expect(host.textContent).toBe("Signed out")
})

it("retries an interrupted initial account lookup on navigation", async () => {
  const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("offline"))
  await navigate("/en")
  get.mockResolvedValueOnce({ status: 200, data: { displayname: "Reader" } })
  await navigate("/en/apps/search?q=music")
  expect(host.textContent).toBe("Reader")
})

it("refreshes the profile when another tab switches accounts", async () => {
  const get = vi.spyOn(axios, "get").mockResolvedValueOnce({
    status: 200,
    data: { displayname: "First account", invite_code: "first" },
  })
  vi.spyOn(axios, "head").mockResolvedValueOnce({
    status: 200,
    headers: { "flathub-account-invite-code": "second" },
  })
  await navigate("/en")
  expect(host.textContent).toBe("First account")
  const lookup = Promise.withResolvers<AxiosResponse>()
  get.mockReturnValueOnce(lookup.promise)
  await navigate("/en/apps/search?q=music")
  expect(host.textContent).toBe("Signed out")
  await act(async () =>
    lookup.resolve({
      status: 200,
      data: { displayname: "Second account", invite_code: "second" },
    } as AxiosResponse),
  )
  expect(host.textContent).toBe("Second account")
})

it("keeps the last known account state when a background lookup is interrupted", async () => {
  const get = vi.spyOn(axios, "get").mockResolvedValueOnce({ status: 204 })
  const head = vi.spyOn(axios, "head").mockResolvedValueOnce({ status: 200 })
  await navigate("/en")
  const lookup = Promise.withResolvers<AxiosResponse>()
  get.mockReturnValueOnce(lookup.promise)
  await navigate("/en/apps/search?q=music")
  expect(host.textContent).toBe("Signed out")

  head.mockRejectedValueOnce(new Error("offline"))
  await navigate("/en/apps/search?q=video")
  await act(async () => lookup.resolve({ status: 200 } as AxiosResponse))
  expect(host.textContent).toBe("Signed out")
})

it("keeps a newer sign-in when a background account lookup finishes", async () => {
  const get = vi.spyOn(axios, "get").mockResolvedValueOnce({ status: 204 })
  vi.spyOn(axios, "head").mockResolvedValueOnce({ status: 200 })
  await navigate("/en", true)
  const lookup = Promise.withResolvers<AxiosResponse>()
  get.mockReturnValueOnce(lookup.promise)
  await navigate("/en/apps/search?q=music", true)
  await act(async () => host.querySelector("button")!.click())
  await act(async () =>
    lookup.resolve({
      status: 200,
      data: { displayname: "Old account" },
    } as AxiosResponse),
  )
  expect(host.textContent).toBe("New account")
})
