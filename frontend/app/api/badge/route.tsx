import satori from "satori"
import { NextRequest, NextResponse } from "next/server"
import { Resvg } from "@resvg/resvg-js"
import { fonts } from "../fontManager"
import { getTranslations } from "next-intl/server"
import { routing } from "src/i18n/routing"
import { hasLocale } from "next-intl"
import { BADGE_SIZES, parseBadgeSize } from "src/badges/badge-size"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const locale = searchParams.get("locale") || "en"
  const light = searchParams.get("light") === "" || false
  const asSvg = searchParams.get("svg") === "" || false
  const size = parseBadgeSize(searchParams.get("size"))

  if (!size) {
    return NextResponse.json({ error: "Invalid badge size" }, { status: 400 })
  }

  const dimensions = BADGE_SIZES[size]

  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  const t = await getTranslations({ locale })

  const flathub = t("flathub")

  const getItOn = t("get-it-on").toUpperCase()

  const badge = (
    <div
      style={{
        display: "flex",
        backgroundColor: light ? "white" : "black",
        width: size === "padded" ? `${dimensions.badgeWidth}px` : "100%",
        height: size === "padded" ? `${dimensions.badgeHeight}px` : "100%",
        color: light ? "black" : "white",
        borderColor: light ? "black" : "#888A85",
        borderWidth: "2px",
        borderStyle: "solid",
        borderRadius: `${dimensions.borderRadius}px`,
        alignItems: "center",
        justifyContent: size === "padded" ? "center" : undefined,
        gap: `${dimensions.gap}px`,
        paddingLeft: `${dimensions.padding}px`,
        paddingRight: `${dimensions.padding}px`,
      }}
    >
      <svg
        width={dimensions.iconWidth}
        height={dimensions.iconHeight}
        version="1.1"
        viewBox="0 0 66.885 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(-30.558 -32)">
          <g
            transform="matrix(1.7016 0 0 1.7016 -237.69 -115.36)"
            fill="currentColor"
          >
            <circle cx="166.69" cy="95.647" r="9.0478" strokeWidth=".58767" />
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter-SemiBold",
          fontSize: `${dimensions.labelFontSize}px`,
          lineHeight: `${dimensions.labelLineHeight}px`,
          paddingTop: `${dimensions.namePaddingTop}px`,
        }}
      >
        {getItOn}
        <span
          style={{
            fontFamily: "Inter-SemiBold",
            fontSize: `${dimensions.nameFontSize}px`,
            fontStyle: "normal",
            lineHeight: `${dimensions.nameLineHeight}px`,
            letterSpacing: "0px",
          }}
        >
          {flathub}
        </span>
      </div>
    </div>
  )

  const svg = await satori(
    size === "padded" ? (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badge}
      </div>
    ) : (
      badge
    ),
    {
      width: dimensions.canvasWidth,
      height: dimensions.canvasHeight,
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
    fitTo: {
      mode: "width",
      value: dimensions.canvasWidth,
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
