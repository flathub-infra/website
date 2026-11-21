// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import SetupControls from "./SetupControls"

const state = vi.hoisted(() => ({
  price: 500,
  share: 50,
  account: "owner",
  post: vi.fn(),
  client: undefined as QueryClient | undefined,
  saved: undefined as undefined | ((response: unknown) => Promise<void>),
}))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({ info: { invite_code: state.account } }),
}))
vi.mock("src/codegen", () => ({
  getGetManagementVendingSetupVendingappAppIdManagementSetupGetQueryKey: (
    appId: string,
  ) => [`/vendingapp/${appId}/management-setup`],
  useGetManagementVendingSetupVendingappAppIdManagementSetupGet: (
    _id: string,
    options: { query: { queryKey: readonly unknown[] } },
  ) => ({
    queryKey: options.query.queryKey,
    data: {
      data: {
        status: "ok",
        is_owner: true,
        recommended_donation: state.price,
        minimum_payment: 0,
        appshare: state.share,
      },
    },
  }),
  postAppVendingSetupVendingappAppIdSetupPost: state.post,
}))
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useQuery: () => ({ data: { data: { details_submitted: true } } }),
  useMutation: ({
    mutationFn,
    onMutate,
    onSuccess,
  }: {
    mutationFn: () => void
    onMutate: () => readonly unknown[]
    onSuccess: (
      data: unknown,
      variables: undefined,
      key: readonly unknown[],
    ) => Promise<void>
  }) => {
    return {
      mutate: () => {
        const key = onMutate()
        state.saved = (data) => onSuccess(data, undefined, key)
        mutationFn()
      },
    }
  },
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))
vi.mock("src/i18n/navigation", () => ({ Link: "a", useRouter: () => ({}) }))
vi.mock("@/components/ui/switch", () => ({ Switch: () => null }))
vi.mock("./VendingSharesPreview", () => ({
  default: ({ setAppShare }: { setAppShare: (share: number) => void }) => (
    <button type="button" onClick={() => setAppShare(60)}>
      Change share
    </button>
  ),
}))

it("preserves edited fields while submitting refreshed values for untouched fields", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  const render = () =>
    act(async () =>
      root.render(
        <SetupControls
          app={{
            id: "org.example.App",
            name: "Example",
            bundle: { type: "flatpak", value: "org.example.App" },
          }}
          vendingConfig={{
            status: "ok",
            platforms: {},
            fee_cost_percent: 0,
            fee_fixed_cost: 0,
            fee_prefer_percent: 0,
          }}
        />,
      ),
    )
  try {
    await render()
    state.price = 800
    await render()
    expect(host.querySelector("input")?.value).toBe("8.00")
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent === "Change share")!
        .click(),
    )
    state.price = 900
    state.share = 30
    await render()
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    )
    expect(state.post).toHaveBeenCalledWith(
      "org.example.App",
      expect.objectContaining({ recommended_donation: 900, appshare: 60 }),
      { withCredentials: true },
    )
    const price = host.querySelector("input")!
    await act(async () => {
      price.focus()
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(price, "10.07")
      price.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => host.querySelector("form")!.requestSubmit())
    expect(state.post).toHaveBeenLastCalledWith(
      "org.example.App",
      expect.objectContaining({ recommended_donation: 1007 }),
      { withCredentials: true },
    )
    const key = ["/vendingapp/org.example.App/management-setup", "owner"]
    const client = new QueryClient()
    state.client = client
    await render()
    client.setQueryData(key, "before save")
    await act(async () => host.querySelector("form")!.requestSubmit())
    const delayed = Promise.withResolvers<string>()
    const read = client
      .fetchQuery({ queryKey: key, queryFn: () => delayed.promise })
      .catch(() => {})
    await act(async () => state.saved!("committed"))
    delayed.resolve("previous")
    await read
    expect(client.getQueryData(key)).toBe("committed")
    await act(async () => host.querySelector("form")!.requestSubmit())
    const completeOldSave = state.saved!
    client.clear()
    state.account = "reader"
    const readerKey = [key[0], "reader"]
    client.setQueryData(readerKey, { is_owner: false })
    await render()
    await act(async () => completeOldSave({ is_owner: true }))
    expect(client.getQueryData(readerKey)).toEqual({ is_owner: false })
    expect(client.getQueryData(key)).toBeUndefined()
    client.clear()
  } finally {
    await act(async () => root.unmount())
    host.remove()
    state.account = "owner"
    vi.unstubAllGlobals()
  }
})
