import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"
import messages from "../../../public/locales/en/common.json"
import { AppDevModeration } from "./AppDevModeration"

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  query: vi.fn(),
  request: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
vi.mock("src/i18n/navigation", () => ({
  usePathname: () => "/apps/manage/org.example.App",
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.query }))
vi.mock("src/codegen", () => ({
  getModerationAppModerationAppsAppIdGet: mocks.request,
}))
vi.mock("./AppModeration", () => ({ getReviewRow: vi.fn() }))
vi.mock("../Pagination", () => ({ default: () => null }))

function render() {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <AppDevModeration appId="org.example.App" />
    </NextIntlClientProvider>,
  )
}

describe("developer review queue", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams()
    mocks.request.mockReset()
    mocks.query.mockReset()
    mocks.query.mockReturnValue({
      isSuccess: true,
      data: { data: { requests: [], requests_count: 0 } },
    })
  })

  it("requests pending reviews by default and explains the empty state", () => {
    expect(render()).toContain("No changes awaiting review")
    const signal = new AbortController().signal
    mocks.query.mock.calls[0][0].queryFn({ signal })
    expect(mocks.request).toHaveBeenCalledWith(
      "org.example.App",
      { include_handled: false, include_outdated: false, limit: 10, offset: 0 },
      { withCredentials: true, signal },
    )
  })

  it("restores history and pagination from the URL with a separate cache entry", () => {
    mocks.params = new URLSearchParams("reviewHistory=true&page=2")
    mocks.query.mockReturnValue({
      isSuccess: true,
      data: { data: { requests: [], requests_count: 11 } },
    })
    render()
    const options = mocks.query.mock.calls[0][0]
    options.queryFn({ signal: new AbortController().signal })
    expect(mocks.request.mock.calls[0][1]).toEqual({
      include_handled: true,
      include_outdated: true,
      limit: 10,
      offset: 10,
    })
    expect(options.queryKey).toEqual([
      "moderation",
      "org.example.App",
      true,
      10,
      10,
    ])
  })

  it("does not report all caught up for an empty page when pending reviews exist", () => {
    mocks.params = new URLSearchParams("page=2")
    mocks.query.mockReturnValue({
      isSuccess: true,
      data: { data: { requests: [], requests_count: 1 } },
    })
    const html = render()
    expect(html).not.toContain("No changes awaiting review")
    expect(html).not.toContain("You're all caught up")
  })

  it.each(["0", "-1", "invalid", "1.5"])(
    "uses a valid offset for page=%s",
    (page) => {
      mocks.params.set("page", page)
      render()
      mocks.query.mock.calls[0][0].queryFn({
        signal: new AbortController().signal,
      })
      expect(mocks.request.mock.calls[0][1].offset).toBe(0)
    },
  )
})
