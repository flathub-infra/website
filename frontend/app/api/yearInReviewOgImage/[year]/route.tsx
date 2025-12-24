import { Resvg } from "@resvg/resvg-js"
import satori from "satori"
import { NextRequest, NextResponse } from "next/server"
import axios from "axios"
import { fonts } from "app/api/fontManager"
import { getApiBaseUrl } from "src/utils/api-url"
import {
  getYearInReviewYearInReviewYearGet,
  YearInReviewResult,
} from "src/codegen"
import { getTranslations } from "next-intl/server"
import { routing } from "src/i18n/routing"
import { hasLocale } from "next-intl"

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
      locale: "en",
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

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  // Get top 3 app icons for the visual
  const topAppIcons = data.top_apps.slice(0, 3).map((app) => app.icon)

  const svg = await satori(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(135deg, #1a1f2e 0%, #0d1117 50%, #161b22 100%)",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(74, 144, 226, 0.15) 0%, transparent 70%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-150px",
          left: "-100px",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "48px 64px",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Flathub Logo */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 66.885 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="translate(-30.558 -32)">
                <g
                  transform="matrix(1.7016 0 0 1.7016 -237.69 -115.36)"
                  fill="#4A90E2"
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
            <span
              style={{
                fontFamily: "Inter-Black",
                fontSize: "32px",
                color: "#ffffff",
              }}
            >
              Flathub
            </span>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter-SemiBold",
              fontSize: "20px",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            {t("year-in-review.title")}
          </div>
        </div>

        {/* Year and Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "-20px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Inter-Black",
              fontSize: "140px",
              lineHeight: "1",
              background:
                "linear-gradient(135deg, #4A90E2 0%, #A855F7 50%, #EC4899 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {year}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "48px",
            marginTop: "-10px",
          }}
        >
          {/* Downloads */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Black",
                fontSize: "48px",
                color: "#4A90E2",
              }}
            >
              {formatNumber(data.total_downloads)}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Regular",
                fontSize: "18px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {t("year-in-review.total-downloads")}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "1px",
              height: "80px",
              background: "rgba(255, 255, 255, 0.2)",
            }}
          />

          {/* New Apps */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Black",
                fontSize: "48px",
                color: "#A855F7",
              }}
            >
              {formatNumber(data.new_apps_count)}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Regular",
                fontSize: "18px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {t("year-in-review.new-apps")}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "1px",
              height: "80px",
              background: "rgba(255, 255, 255, 0.2)",
            }}
          />

          {/* Updates */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Black",
                fontSize: "48px",
                color: "#EC4899",
              }}
            >
              {formatNumber(data.updates_count)}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Regular",
                fontSize: "18px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {t("year-in-review.app-updates")}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "1px",
              height: "80px",
              background: "rgba(255, 255, 255, 0.2)",
            }}
          />

          {/* Total Apps */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Black",
                fontSize: "48px",
                color: "#10B981",
              }}
            >
              {formatNumber(data.total_apps)}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Inter-Regular",
                fontSize: "18px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {t("year-in-review.total-apps")}
            </div>
          </div>
        </div>

        {/* Top Apps Preview */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Inter-SemiBold",
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.5)",
              marginRight: "8px",
            }}
          >
            {t("year-in-review.top-apps")}:
          </div>
          {topAppIcons.map((icon, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                border: "2px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={icon.replace(/.webp$/, ".png")}
                  width={52}
                  height={52}
                  alt=""
                  style={{
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Inter-Regular",
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.4)",
            }}
          >
            flathub.org/year-in-review/{year}
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: fonts,
    },
  )

  if (asSvg) {
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    })
  }

  const renderer = new Resvg(svg, {
    background: "#0d1117",
    fitTo: {
      mode: "width",
      value: 1200,
    },
  })
  const image = renderer.render()

  const pngBuffer = image.asPng() as BodyInit

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
