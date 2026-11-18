import { renderToStaticMarkup } from "react-dom/server"
import type { ReactNode } from "react"
import { NextRequest } from "next/server"
import { createTranslator } from "next-intl"
import deepmerge from "deepmerge"
import en from "../../../../public/locales/en/common.json"
import { expect, test, vi } from "vitest"
import { GET } from "./route"
import { getYearInReviewYearInReviewYearGet } from "src/codegen"

vi.mock("src/codegen", () => ({
  getYearInReviewYearInReviewYearGet: vi.fn(async () => ({
    data: {
      total_downloads: 1234567890,
      total_downloads_change: -100,
      total_downloads_change_percentage: 0,
      new_apps_count: 1234,
      updates_count: 1234567,
      total_apps: 5678,
      top_apps: [],
    },
  })),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => {
    const messages = await import(
      `../../../../public/locales/${locale}/common.json`
    )
    return createTranslator({
      locale,
      messages: deepmerge(en, messages.default),
    })
  },
}))

vi.mock("app/api/ogImage", () => ({ getOgImageUrl: vi.fn() }))
vi.mock("app/api/renderOgImage", () => ({
  renderOgImage: (image: ReactNode) =>
    new Response(renderToStaticMarkup(image)),
}))

test.each(["en", "de", "tr", "ar", "ja"])(
  "requests localized metadata and formats OG numbers for %s",
  async (locale) => {
    const response = await GET(
      new NextRequest(
        `https://flathub.org/api/yearInReviewOgImage/2025?locale=${locale}`,
      ),
      { params: Promise.resolve({ year: "2025" }) },
    )
    expect(getYearInReviewYearInReviewYearGet).toHaveBeenLastCalledWith(2025, {
      locale,
    })
    const html = await response.text()
    expect(html).toContain(new Intl.NumberFormat(locale).format(-100))
    const { default: messages } = await import(
      `../../../../public/locales/${locale}/common.json`
    )
    const t = createTranslator({ locale, messages })
    expect(html).toContain(t("year-in-review.title", { year: 2025 }))
    expect(html).toContain(
      renderToStaticMarkup(<>{t("year-in-review.description")}</>),
    )
    for (const value of [1234567890, 1234567, 5678]) {
      expect(html).toContain(
        new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value),
      )
    }
  },
)
