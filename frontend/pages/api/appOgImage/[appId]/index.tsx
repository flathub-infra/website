/* eslint-disable @next/next/no-img-element */
import type { NextApiRequest, NextApiResponse } from "next"
import { promises as fs } from "fs"
import path from "path"

import { Resvg } from "@resvg/resvg-js"
import i18next from "i18next"
import { languages } from "src/localize"
import satori from "satori"
import { fetchAppstream } from "src/fetchers"
import { getContrastColor } from "src/utils/helpers"
import { DesktopAppstream, mapScreenshot } from "src/types/Appstream"
import { getIsFullscreenAppIsFullscreenAppAppIdGet } from "src/codegen"

type ResponseData = {
  message: string
}

async function createInterRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createInterSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createInterBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  const ns = ["common"]
  const supportedLngs = languages
  const resources = ns.reduce((acc, n) => {
    supportedLngs.forEach((lng) => {
      if (!acc[lng]) acc[lng] = {}
      acc[lng] = {
        ...acc[lng],
        [n]: require(`../../../../public/locales/${lng}/${n}.json`),
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

  const locale = req.query.locale || "en"
  const asSvg = req.query.svg === "" || false

  const appId = req.query.appId as string

  const app: DesktopAppstream = await (
    await fetchAppstream(appId as string)
  ).data

  const isFullscreenApp = await getIsFullscreenAppIsFullscreenAppAppIdGet(
    appId as string,
  )

  if (!app) {
    return res.status(404).json({ message: "App not found" })
  }

  const icon =
    app.icons.sort(
      (a, b) => (b.scale ?? 0) - (a.scale ?? 0) || b.height - a.height,
    )[0].url ?? app.icon

  const screenshot =
    app.screenshots.length > 0 ? mapScreenshot(app.screenshots[0]) : null

  const branding = app.branding?.[0].value ?? "#FAFAFA"

  const textColor = getContrastColor(branding)

  const svg = await satori(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: branding,
        width: "100%",
        height: "100%",
        color: textColor,
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "90%",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "300px",
          }}
        >
          <img
            style={{
              display: "flex",
              width: "256",
              height: "256",
              borderRadius: "16px",
              filter:
                "drop-shadow(0 4px 3px #00000009) drop-shadow(0 2px 2px #00000040)",
            }}
            src={icon}
            alt=""
          />
          <h1
            style={{
              fontFamily: "Inter-Black",
              fontSize: "40px",
              lineHeight: "48px",
            }}
          >
            {app.name}
          </h1>
          <div
            style={{
              fontFamily: "Inter-Regular",
              fontSize: "24px",
              lineHeight: "32px",
              textAlign: "center",
            }}
          >
            {app.summary}
          </div>
        </div>
        {screenshot && screenshot.width > screenshot.height && (
          <img
            style={{
              display: "flex",
              width: "620px",
              borderRadius: isFullscreenApp ? "8px" : "0px",
            }}
            src={screenshot.src}
            alt=""
          />
        )}
        {screenshot && screenshot.width < screenshot.height && (
          <img
            style={{
              display: "flex",
              height: "420px",
              borderRadius: isFullscreenApp ? "8px" : "0px",
            }}
            src={screenshot.src}
            alt=""
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyItems: "flex-end",
          alignItems: "center",
          gap: "8px",
          justifySelf: "flex-end",
          alignSelf: "flex-end",
          paddingRight: "8px",
        }}
      >
        <svg
          width="36.885"
          height="36"
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter-SemiBold",
            fontSize: "12px",
            lineHeight: "16px",
          }}
        >
          <span
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: "29px",
              fontStyle: "normal",
              lineHeight: "30px",
              letterSpacing: "0px",
            }}
          >
            Flathub
          </span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 628,
      fonts: [
        (await createInterRegular()) as any,
        (await createInterSemiBold()) as any,
        (await createInterBlack()) as any,
      ],
    },
  )

  res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  if (asSvg) {
    res.setHeader("Content-Type", "image/svg+xml")
    res.end(svg)
    return
  }

  const renderer = new Resvg(svg, {
    background: "#fff",
    fitTo: {
      mode: "width",
      value: 1200,
    },
  })
  const image = renderer.render()

  const pngBuffer = image.asPng()

  res.setHeader("Content-Type", "image/png")
  res.end(pngBuffer)
}
