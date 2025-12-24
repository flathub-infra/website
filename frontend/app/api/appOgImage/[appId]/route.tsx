import { Resvg } from "@resvg/resvg-js"
import satori from "satori"
import { DesktopAppstream, getAppstreamAppstreamAppIdGet } from "src/codegen"
import { getContrastColor, hexToRgb } from "@/lib/helpers"
import { mapScreenshot } from "src/types/Appstream"
import { getIsFullscreenAppIsFullscreenAppAppIdGet } from "src/codegen"
import { NextRequest } from "next/server"
import axios from "axios"
import { fonts } from "app/api/fontManager"
import { fontLanguageDenyList, Language, languages } from "src/localize"
import { getApiBaseUrl } from "src/utils/api-url"
import { getTranslations } from "next-intl/server"
import { hasLocale } from "next-intl"
import { routing } from "src/i18n/routing"

function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const adjust = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value + (255 * percent) / 100)))

  const r = adjust(rgb.r).toString(16).padStart(2, "0")
  const g = adjust(rgb.g).toString(16).padStart(2, "0")
  const b = adjust(rgb.b).toString(16).padStart(2, "0")

  return `#${r}${g}${b}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params

  axios.interceptors.request.use((config) => {
    return {
      ...config,
      baseURL: getApiBaseUrl(),
    }
  })

  const searchParams = request.nextUrl.searchParams
  const locale = searchParams.get("locale") || "en"
  const asSvg = searchParams.get("svg") === "" || false

  // Fall back to English if the locale is in the deny list or not supported
  const safeLocale =
    fontLanguageDenyList.includes(locale) ||
    !languages.includes(locale as Language)
      ? "en"
      : locale

  // Get translations for the safe locale
  const translationLocale = hasLocale(routing.locales, safeLocale)
    ? safeLocale
    : "en"
  const t = await getTranslations({ locale: translationLocale })
  const getItOn = t("get-it-on")

  let app: DesktopAppstream
  try {
    const response = await getAppstreamAppstreamAppIdGet(appId as string, {
      locale: safeLocale as string,
    })
    app = response.data as unknown as DesktopAppstream

    if (!app) {
      return new Response("App not found", {
        status: 404,
        statusText: "App not found",
      })
    }
  } catch (error) {
    return new Response("App not found", {
      status: 404,
      statusText: "App not found",
    })
  }

  const isFullscreenApp = (
    await getIsFullscreenAppIsFullscreenAppAppIdGet(appId as string)
  ).data

  const icon =
    (Array.isArray(app.icons)
      ? app.icons.sort(
          (a, b) => (b.scale ?? 0) - (a.scale ?? 0) || b.height - a.height,
        )?.[0]?.url
      : undefined) ?? app.icon

  const screenshot =
    Array.isArray(app.screenshots) && app.screenshots.length > 0
      ? mapScreenshot(app.screenshots[0])
      : null

  const branding = app.branding?.[0].value ?? "#4A86CF"
  const brandingLight = adjustBrightness(branding, 10)
  const brandingDark = adjustBrightness(branding, -10)

  const textColor = getContrastColor(branding)
  const subtitleColor =
    textColor === "white" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.8)"

  const isLandscapeScreenshot =
    screenshot && screenshot.width && screenshot.height
      ? screenshot.width > screenshot.height
      : true

  const gradientEnd = textColor === "white" ? brandingLight : brandingDark

  const svg = await satori(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(to top, ${branding} 50%, ${gradientEnd} 100%)`,
        width: "100%",
        height: "100%",
        color: textColor,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle pattern overlay */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `radial-gradient(circle at 20% 80%, ${textColor === "white" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${textColor === "white" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 0%, transparent 50%)`,
        }}
      />

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: "48px",
          paddingBottom: "24px",
          gap: "48px",
          alignItems: "center",
        }}
      >
        {/* Left side - App info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: screenshot && isLandscapeScreenshot ? "380px" : "450px",
            flexShrink: 0,
          }}
        >
          {/* Icon */}
          {icon && (
            <img
              style={{
                display: "flex",
                width: "160px",
                height: "160px",
                marginBottom: "24px",
              }}
              src={icon.replace(/.webp$/, ".png")}
              alt=""
            />
          )}

          {/* App name */}
          <h1
            style={{
              fontFamily: "Inter-Black",
              fontSize: "48px",
              lineHeight: "54px",
              margin: 0,
              marginBottom: "12px",
              textAlign: "center",
              textShadow:
                textColor === "white"
                  ? "0 2px 10px rgba(0,0,0,0.2)"
                  : "0 1px 4px rgba(255,255,255,0.1)",
            }}
          >
            {app.name}
          </h1>

          {/* Summary */}
          <div
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: "26px",
              lineHeight: "38px",
              color: subtitleColor,
              textAlign: "center",
            }}
          >
            {app.summary}
          </div>
        </div>

        {/* Right side - Screenshot */}
        {screenshot && isLandscapeScreenshot && (
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              style={{
                display: "flex",
                width: "680px",
              }}
              src={screenshot.src.replace(/.webp$/, ".png")}
              alt=""
            />
          </div>
        )}

        {/* Portrait screenshot - displayed smaller on the right */}
        {screenshot && !isLandscapeScreenshot && (
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              style={{
                display: "flex",
                height: "450px",
              }}
              src={screenshot.src.replace(/.webp$/, ".png")}
              alt=""
            />
          </div>
        )}
      </div>

      {/* Bottom bar - Flathub branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 48px",
          borderTop: `2px solid ${textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}`,
        }}
      >
        {/* Left side - "Get it on" text */}
        <div
          style={{
            display: "flex",
            fontFamily: "Inter-SemiBold",
            fontSize: "22px",
            color: textColor,
          }}
        >
          {getItOn}
        </div>

        {/* Right side - Flathub logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <svg
            width="44"
            height="44"
            version="1.1"
            viewBox="0 0 66.885 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(-30.558 -32)">
              <g
                transform="matrix(1.7016 0 0 1.7016 -237.69 -115.36)"
                fill="currentColor"
              >
                <circle
                  cx="166.69"
                  cy="95.647"
                  r="9.0478"
                  stroke-width=".58767"
                />
                <rect
                  x="158.41"
                  y="107.8"
                  width="16.412"
                  height="16.412"
                  rx="4.3765"
                  ry="4.3765"
                  stroke-width=".58767"
                />
                <path
                  transform="matrix(.9259 .53457 .53457 -.9259 99.826 110.69)"
                  d="m69.514 58.833h-1.7806-10.247a2.4441 2.4441 60 0 1-2.1167-3.6662l6.0139-10.416a2.4441 2.4441 2.522e-7 0 1 4.2333 0l6.0139 10.416a2.4441 2.4441 120 0 1-2.1167 3.6662z"
                  stroke-width=".55348"
                />
                <path
                  d="m194.99 116.11c0 0.87946-0.70801 1.5875-1.5875 1.5875h-12.7c-0.87946 0-1.5875-0.70802-1.5875-1.5875s0.70802-1.5875 1.5875-1.5875h12.7c0.87946 0 1.5875 0.70801 1.5875 1.5875zm-7.9375-7.9375c0.87946 0 1.5875 0.70802 1.5875 1.5875v12.7c0 0.87946-0.70802 1.5875-1.5875 1.5875-0.87947 0-1.5875-0.70802-1.5875-1.5875v-12.7c0-0.87947 0.70802-1.5875 1.5875-1.5875z"
                  stroke-width="5.8767"
                />
              </g>
            </g>
          </svg>
          <span
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: "36px",
              letterSpacing: "-0.5px",
            }}
          >
            Flathub
          </span>
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  }

  const renderer = new Resvg(svg, {
    background: "#fff",
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
