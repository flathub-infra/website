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
import { getOgImageUrl } from "app/api/ogImage"

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

  const scale = 1
  const iconImage = icon
    ? getOgImageUrl(icon, 160 * scale, 160 * scale)
    : undefined

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
          padding: `${48 * scale}px`,
          paddingBottom: `${40 * scale}px`,
          gap: `${48 * scale}px`,
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
            width:
              screenshot && isLandscapeScreenshot
                ? `${380 * scale}px`
                : `${450 * scale}px`,
            flexShrink: 0,
          }}
        >
          {/* Icon */}
          {iconImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              width={160 * scale}
              height={160 * scale}
              style={{
                display: "flex",
                width: `${160 * scale}px`,
                height: `${160 * scale}px`,
                marginBottom: `${24 * scale}px`,
              }}
              src={iconImage}
              alt=""
            />
          )}

          {/* App name */}
          <h1
            style={{
              fontFamily: "Inter-Black",
              fontSize: `${48 * scale}px`,
              lineHeight: `${54 * scale}px`,
              margin: 0,
              marginBottom: `${12 * scale}px`,
              textAlign: "center",
              textShadow:
                textColor === "white"
                  ? `0 ${2 * scale}px ${10 * scale}px rgba(0,0,0,0.2)`
                  : `0 ${1 * scale}px ${4 * scale}px rgba(255,255,255,0.1)`,
            }}
          >
            {app.name}
          </h1>

          {/* Summary */}
          <div
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: `${26 * scale}px`,
              lineHeight: `${38 * scale}px`,
              color: subtitleColor,
              textAlign: "center",
            }}
          >
            {app.summary}
          </div>
        </div>

        {/* Right side - Screenshot */}
        {screenshot &&
          isLandscapeScreenshot &&
          (() => {
            const hasValidDims =
              screenshot.width &&
              screenshot.height &&
              !isNaN(screenshot.width) &&
              !isNaN(screenshot.height)
            const maxW = 680 * scale
            const maxH = 450 * scale
            const computedHeight = hasValidDims
              ? Math.round(maxW * (screenshot.height! / screenshot.width!))
              : null
            const clampedWidth =
              computedHeight && computedHeight > maxH
                ? Math.round(maxH * (screenshot.width! / screenshot.height!))
                : maxW
            const clampedHeight = computedHeight
              ? Math.min(computedHeight, maxH)
              : maxH
            const screenshotImage = getOgImageUrl(
              screenshot.src,
              clampedWidth,
              clampedHeight,
            )
            return (
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  width={clampedWidth}
                  height={clampedHeight}
                  style={{
                    display: "flex",
                    width: `${clampedWidth}px`,
                    height: `${clampedHeight}px`,
                  }}
                  src={screenshotImage}
                  alt=""
                />
              </div>
            )
          })()}

        {/* Portrait screenshot - displayed smaller on the right */}
        {screenshot &&
          !isLandscapeScreenshot &&
          (() => {
            const hasValidDims =
              screenshot.width &&
              screenshot.height &&
              !isNaN(screenshot.width) &&
              !isNaN(screenshot.height)
            const maxPortraitWidth = 350 * scale
            const targetH = 420 * scale
            const computedWidth = hasValidDims
              ? Math.round(targetH * (screenshot.width! / screenshot.height!))
              : null
            const rawWidth = computedWidth ?? 253 * scale
            const height =
              rawWidth > maxPortraitWidth
                ? Math.round(
                    maxPortraitWidth * (screenshot.height! / screenshot.width!),
                  )
                : targetH
            const width = Math.min(rawWidth, maxPortraitWidth)
            const screenshotImage = getOgImageUrl(screenshot.src, width, height)
            return (
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  width={width}
                  height={height}
                  style={{
                    display: "flex",
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                  src={screenshotImage}
                  alt=""
                />
              </div>
            )
          })()}
      </div>

      {/* Bottom bar - Flathub branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${28 * scale}px ${48 * scale}px`,
          borderTop: `${2 * scale}px solid ${textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}`,
        }}
      >
        {/* Left side - "Get it on" text */}
        <div
          style={{
            display: "flex",
            fontFamily: "Inter-SemiBold",
            fontSize: `${22 * scale}px`,
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
            gap: `${12 * scale}px`,
          }}
        >
          <svg
            width={44 * scale}
            height={44 * scale}
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
                  strokeWidth=".58767"
                />
                <rect
                  x="158.41"
                  y="107.8"
                  width="16.412"
                  height="16.412"
                  rx="4.3765"
                  ry="4.3765"
                  strokeWidth=".58767"
                />
                <path
                  transform="matrix(.9259 .53457 .53457 -.9259 99.826 110.69)"
                  d="m69.514 58.833h-1.7806-10.247a2.4441 2.4441 60 0 1-2.1167-3.6662l6.0139-10.416a2.4441 2.4441 2.522e-7 0 1 4.2333 0l6.0139 10.416a2.4441 2.4441 120 0 1-2.1167 3.6662z"
                  strokeWidth=".55348"
                />
                <path
                  d="m194.99 116.11c0 0.87946-0.70801 1.5875-1.5875 1.5875h-12.7c-0.87946 0-1.5875-0.70802-1.5875-1.5875s0.70802-1.5875 1.5875-1.5875h12.7c0.87946 0 1.5875 0.70801 1.5875 1.5875zm-7.9375-7.9375c0.87946 0 1.5875 0.70802 1.5875 1.5875v12.7c0 0.87946-0.70802 1.5875-1.5875 1.5875-0.87947 0-1.5875-0.70802-1.5875-1.5875v-12.7c0-0.87947 0.70802-1.5875 1.5875-1.5875z"
                  strokeWidth="5.8767"
                />
              </g>
            </g>
          </svg>
          <span
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: `${36 * scale}px`,
              letterSpacing: `${-0.5 * scale}px`,
            }}
          >
            Flathub
          </span>
        </div>
      </div>
    </div>,
    {
      width: 1200 * scale,
      height: 600 * scale,
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
