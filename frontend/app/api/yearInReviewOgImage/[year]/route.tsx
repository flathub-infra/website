import { formatDownloadChange } from "src/formatDownloadChange"
import { NextRequest, NextResponse } from "next/server"
import axios from "axios"
import { getApiBaseUrl } from "src/utils/api-url"
import {
  getYearInReviewYearInReviewYearGet,
  YearInReviewResult,
} from "src/codegen"
import { getTranslations } from "next-intl/server"
import { routing } from "src/i18n/routing"
import { hasLocale } from "next-intl"
import { getOgImageUrl } from "app/api/ogImage"
import { getLangDir } from "rtl-detect"
import { renderOgImage } from "app/api/renderOgImage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year: yearParam } = await params

  axios.interceptors.request.use((config) => {
    return {
      ...config,
      baseURL: getApiBaseUrl(),
    }
  })

  const searchParams = request.nextUrl.searchParams
  const asSvg = searchParams.get("svg") === "" || false
  const locale = searchParams.get("locale") || "en"

  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  const t = await getTranslations({ locale })

  const year = parseInt(yearParam, 10)

  if (isNaN(year) || year < 2018 || year > new Date().getFullYear()) {
    return new Response("Invalid year", {
      status: 400,
      statusText: "Invalid year",
    })
  }

  let data: YearInReviewResult
  try {
    const response = await getYearInReviewYearInReviewYearGet(year, {
      locale,
    })
    data = response.data

    if (!data) {
      return new Response("Year in review data not found", {
        status: 404,
        statusText: "Year in review data not found",
      })
    }
  } catch (error) {
    return new Response("Year in review data not found", {
      status: 404,
      statusText: "Year in review data not found",
    })
  }

  const formatNumber = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format

  // Get top 3 app icons for the visual
  const topAppIcons = data.top_apps
    .slice(0, 3)
    .map((app) => (app.icon ? getOgImageUrl(app.icon, 52, 52) : null))

  const comparison = formatDownloadChange(
    locale,
    data.total_downloads_change,
    data.total_downloads_change_percentage,
  )
  const image = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        direction: getLangDir(locale),
        background:
          "linear-gradient(115deg, #d9eff4 0%, #e3e2fa 58%, #f6deee 100%)",
        color: "#28223e",
        fontFamily: "Inter-SemiBold",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "32px 54px 0",
          fontFamily: "Inter-Black",
          fontSize: 34,
        }}
      >
        {" "}
        <svg
          width="48"
          height="48"
          viewBox="0 0 66.885 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(-30.558 -32)">
            <g
              transform="matrix(1.7016 0 0 1.7016 -237.69 -115.36)"
              fill="#28223e"
            >
              <circle cx="166.69" cy="95.647" r="9.0478" />
              <rect
                x="158.41"
                y="107.8"
                width="16.412"
                height="16.412"
                rx="4.3765"
                ry="4.3765"
              />
              <path
                transform="matrix(.9259 .53457 .53457 -.9259 99.826 110.69)"
                d="m69.514 58.833h-1.7806-10.247a2.4441 2.4441 60 0 1-2.1167-3.6662l6.0139-10.416a2.4441 2.4441 2.522e-7 0 1 4.2333 0l6.0139 10.416a2.4441 2.4441 120 0 1-2.1167 3.6662z"
              />
              <path d="m194.99 116.11c0 0.87946-0.70801 1.5875-1.5875 1.5875h-12.7c-0.87946 0-1.5875-0.70802-1.5875-1.5875s0.70802-1.5875 1.5875-1.5875h12.7c0.87946 0 1.5875 0.70801 1.5875 1.5875zm-7.9375-7.9375c0.87946 0 1.5875 0.70802 1.5875 1.5875v12.7c0 0.87946-0.70802 1.5875-1.5875 1.5875-0.87947 0-1.5875-0.70802-1.5875-1.5875v-12.7c0-0.87947 0.70802-1.5875 1.5875-1.5875z" />
            </g>
          </g>
        </svg>
        Flathub
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexGrow: 1,
          padding: "0 70px 8px 54px",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.12,
              fontFamily: "Inter-Black",
            }}
          >
            {t("year-in-review.title", { year })}
          </div>
          <div
            style={{
              fontSize: 29,
              marginTop: 18,
              lineHeight: 1.32,
              fontFamily: "Inter-Regular",
            }}
          >
            {t("year-in-review.description")}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          color: "#28223e",
          padding: "26px 54px",
          minHeight: 135,
        }}
      >
        {(
          [
            ["total-downloads", data.total_downloads],
            ["total-apps", data.total_apps],
            ["app-updates", data.updates_count],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            style={{ display: "flex", flexDirection: "column", maxWidth: 265 }}
          >
            <div style={{ fontSize: 19, color: "#554e62" }}>
              {t(`year-in-review.${label}`)}
            </div>
            <div style={{ fontSize: 43, fontFamily: "Inter-Black" }}>
              {formatNumber(value)}
            </div>
            {label === "total-downloads" &&
              year > 2018 &&
              data.total_downloads - data.total_downloads_change > 0 &&
              comparison !== null && (
                <div style={{ fontSize: 17, marginTop: 2 }}>
                  {t("year-in-review.downloads-vs-previous-year", {
                    year: year - 1,
                  })}
                  : {comparison}
                </div>
              )}
          </div>
        ))}
        {topAppIcons.some(Boolean) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 19, color: "#554e62" }}>
              {t("year-in-review.top-apps")}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {topAppIcons.map(
                (icon, index) =>
                  icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={index} src={icon} width={42} height={42} alt="" />
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return renderOgImage(image, {
    width: 1200,
    height: 630,
    locale,
    asSvg,
    cacheControl: asSvg
      ? "public, max-age=3600"
      : "public, max-age=31536000, immutable",
  })
}
