// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"
import { UserContext } from "src/context/user-info"
import type { UserInfo } from "src/codegen/model"
import TokenList from "./TokenList"

const fetchTokens = vi.hoisted(() => vi.fn())
vi.mock("src/codegen", () => ({
  getRedeemableTokensVendingappAppIdTokensGet: fetchTokens,
}))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("src/i18n/navigation", () => ({ Link: "a" }))

it("waits for an account and hides the owner's token while loading another account", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  const client = new QueryClient()
  const reader = Promise.withResolvers<unknown>()
  const token = {
    id: "1",
    name: "Gift",
    state: "redeemed",
    created: "2026-01-01",
  }
  fetchTokens
    .mockResolvedValueOnce({
      data: { tokens: [{ ...token, token: "owner-code" }] },
    })
    .mockReturnValueOnce(reader.promise)
  const render = (account?: string) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <UserContext
            value={{
              loading: !account,
              info: account
                ? ({ invite_code: account } as UserInfo)
                : undefined,
            }}
          >
            <TokenList app={{ id: "org.example.App" }} canManage={false} />
          </UserContext>
        </QueryClientProvider>,
      ),
    )
  const openGift = async () => {
    await vi.waitFor(() => expect(host.textContent).toContain("Gift"))
    await act(async () => host.querySelector("button")!.click())
  }
  try {
    await render()
    expect(fetchTokens).not.toHaveBeenCalled()
    await render("owner")
    await openGift()
    expect(host.textContent).toContain("owner-code")

    await render("reader")
    expect(host.textContent).toBe("loading")
    await act(async () => reader.resolve({ data: { tokens: [token] } }))
    await openGift()
    expect(host.textContent).not.toContain("owner-code")
  } finally {
    await act(async () => root.unmount())
    client.clear()
    host.remove()
    vi.unstubAllGlobals()
  }
})
