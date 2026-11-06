import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { headers } from "next/headers"
import { getYearInReviewYearInReviewYearGet } from "src/codegen"
import YearInReviewPage from "./page"

vi.mock("next/headers", () => ({ headers: vi.fn() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
}))
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock("src/codegen", () => ({
  getYearInReviewYearInReviewYearGet: vi.fn(),
}))
vi.mock("src/components/application/YearInReview", () => ({
  YearInReview: () => null,
}))
vi.mock("src/i18n/navigation", () => ({ Link: "a" }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"))
  vi.mocked(headers).mockResolvedValue(
    new Headers() as Awaited<ReturnType<typeof headers>>,
  )
  vi.mocked(getYearInReviewYearInReviewYearGet).mockImplementation(
    async (year) =>
      ({ data: { year } }) as Awaited<
        ReturnType<typeof getYearInReviewYearInReviewYearGet>
      >,
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

const page = (year: string) =>
  YearInReviewPage({ params: Promise.resolve({ locale: "en", year }) })

test("forwards the admin session for an early current-year preview", async () => {
  vi.mocked(headers).mockResolvedValue(
    new Headers({ cookie: "session=admin" }) as Awaited<
      ReturnType<typeof headers>
    >,
  )
  await expect(page("2026")).resolves.toBeTruthy()
  expect(getYearInReviewYearInReviewYearGet).toHaveBeenCalledWith(
    2026,
    { locale: "en" },
    { headers: { Cookie: "session=admin" } },
  )
})

test("does not render a preview when the API denies access", async () => {
  vi.mocked(getYearInReviewYearInReviewYearGet).mockRejectedValue({
    status: 422,
  })
  await expect(page("2026")).rejects.toThrow("NEXT_NOT_FOUND")
})

test("rejects future years before requesting data", async () => {
  await expect(page("2027")).rejects.toThrow("NEXT_NOT_FOUND")
  expect(getYearInReviewYearInReviewYearGet).not.toHaveBeenCalled()
})

test("keeps published years independent of the visitor's session", async () => {
  await page("2025")
  expect(headers).not.toHaveBeenCalled()
  expect(getYearInReviewYearInReviewYearGet).toHaveBeenCalledWith(
    2025,
    { locale: "en" },
    undefined,
  )
})

test("allows public access starting December 15 UTC", async () => {
  vi.setSystemTime(new Date("2026-12-15T00:00:00Z"))
  await expect(page("2026")).resolves.toBeTruthy()
  expect(headers).not.toHaveBeenCalled()
})
