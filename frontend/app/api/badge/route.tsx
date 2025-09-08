import i18next from "i18next"
import { languages } from "src/localize"
import satori from "satori"
import { NextRequest } from "next/server"
import { Resvg } from "@resvg/resvg-js"
import { fonts } from "../fontManager"

function getTranslationsForKey(key: string) {
  return languages.reduce((messages, currentLang) => {
    messages[currentLang] = i18next.t(key, { lng: currentLang })
    return messages
  }, {})
}

export async function GET(request: NextRequest) {
  const ns = ["common"]
  const supportedLngs = languages
  const resources = ns.reduce((acc, n) => {
    supportedLngs.forEach((lng) => {
      if (!acc[lng]) acc[lng] = {}
      acc[lng] = {
        ...acc[lng],
        [n]: require(`../../../public/locales/${lng}/${n}.json`),
      }
    })
    return acc
  }, {})

  i18next.init({
    lng: "en",
    fallbackLng: "en",
    defaultNS: "common",
    supportedLngs,
    resources,
  })

  const searchParams = request.nextUrl.searchParams
  const locale = searchParams.get("locale") || "en"
  const light = searchParams.get("light") === "" || false
  const asSvg = searchParams.get("svg") === "" || false

  const flathubArray = getTranslationsForKey("flathub")
  const flathub = flathubArray[locale as string]

  const getItOnArray = getTranslationsForKey("get-it-on")
  const getItOn = getItOnArray[locale as string].toUpperCase()

  const svg = await satori(
    <div
      style={{
        display: "flex",
        backgroundColor: light ? "white" : "black",
        width: "100%",
        height: "100%",
        color: light ? "black" : "white",
        borderColor: light ? "black" : "#888A85",
        borderWidth: "2px",
        borderStyle: "solid",
        borderRadius: "16px",
        alignItems: "center",
        gap: "16px",
        paddingLeft: "14px",
        paddingRight: "14px",
      }}
    >
      <svg
        width="55.885"
        height="55"
        version="1.1"
        viewBox="0 0 66.885 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(-30.558 -32)">
          <g
            transform="matrix(1.7016 0 0 1.7016 -237.69 -115.36)"
            fill="currentColor"
          >
            <circle cx="166.69" cy="95.647" r="9.0478" stroke-width=".58767" />
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter-SemiBold",
          fontSize: "16px",
          lineHeight: "18px",
          paddingTop: "6px",
        }}
      >
        {getItOn}
        <span
          style={{
            fontFamily: "Inter-SemiBold",
            fontSize: "36px",
            fontStyle: "normal",
            lineHeight: "46px",
            letterSpacing: "0px",
          }}
        >
          {flathub}
        </span>
      </div>
    </div>,
    {
      width: 240,
      height: 80,
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
      value: 240,
    },
  })
  const image = renderer.render()

  const pngBuffer = image.asPng()

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
