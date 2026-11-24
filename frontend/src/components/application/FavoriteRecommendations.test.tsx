import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import axios from "axios"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import { getGetFavoriteRecommendationsFavoritesAppIdRecommendationsGetQueryKey } from "src/codegen/favorite-recommendations/favorite-recommendations"
import FavoriteRecommendations from "./FavoriteRecommendations"

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => () => "Try Again",
}))
vi.mock("./Collection", () => ({ default: () => <div>App collection</div> }))
afterEach(() => vi.restoreAllMocks())

function setup(apps: { id: string }[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
  })
  const appId = "org.example.App"
  const queryKey =
    getGetFavoriteRecommendationsFavoritesAppIdRecommendationsGetQueryKey(
      appId,
      { locale: "en" },
    )
  client.setQueryData(queryKey, { data: apps })
  const render = () =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <FavoriteRecommendations appId={appId} />
      </QueryClientProvider>,
    )
  return { render, refetch: () => client.refetchQueries({ queryKey }) }
}

it("offers a retry after a failed request but hides a successful empty result", async () => {
  const { render, refetch } = setup([])
  expect(render()).toBe("")
  vi.spyOn(axios, "get").mockRejectedValue({ response: { status: 500 } })
  await refetch()
  expect(render()).toContain("Try Again")
})

it.each([401, 403])(
  "hides cached recommendations on the first %i response",
  async (status) => {
    const { render, refetch } = setup([{ id: "org.example.Other" }])
    expect(render()).toContain("App collection")
    const request = vi
      .spyOn(axios, "get")
      .mockRejectedValue({ response: { status } })
    await refetch()
    expect(request).toHaveBeenCalledTimes(1)
    expect(render()).toBe("")
  },
)
