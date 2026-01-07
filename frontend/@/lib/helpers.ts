import { sanitize } from "isomorphic-dompurify"
import { Branding, GetAppstreamAppstreamAppIdGet200 } from "src/codegen"

export const ConditionalWrapper = ({ condition, wrapper, children }) =>
  condition ? wrapper(children) : children

export const isValidAppId = (appId: string) => {
  if (appId.length < 5) {
    return false
  }
  if (appId.length > 255) {
    return false
  }

  const appIdPattern = /^[A-Za-z_][\w\-\.]+$/
  return appIdPattern.test(appId)
}

export const sanitizeAppstreamDescription = (str: string) => {
  return sanitize(str, {
    ALLOWED_TAGS: ["p", "ul", "li", "ol", "em", "code"],
    ALLOWED_ATTR: [],
  })
}

export function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b
  })

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function getContrastColor(hexColor: string): "black" | "white" {
  const rgb = hexToRgb(hexColor)

  if (!rgb) {
    return "black"
  }

  // http://www.w3.org/TR/AERT#color-contrast
  const brightness = Math.round(
    (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000,
  )
  return brightness > 125 ? "black" : "white"
}

export function chooseBrandingColor(
  branding: Branding[],
  theme: "light" | "dark",
) {
  if (!branding) {
    return undefined
  }

  const brandingColor = branding.find((a) => {
    // if theme is undefined, default to dark
    // this happens when rendering server side
    if (theme) {
      return a.scheme_preference === (theme as "light" | "dark")
    } else {
      return a.scheme_preference === "dark"
    }
  })

  if (brandingColor) {
    return brandingColor
  }

  return branding.find(
    (a) => a.scheme_preference === undefined || a.scheme_preference === null,
  )
}

export function isDesktopAppstreamTypeGuard(
  app: GetAppstreamAppstreamAppIdGet200,
): app is GetAppstreamAppstreamAppIdGet200 & {
  type: "desktop-application" | "console-application" | "desktop"
} {
  return (
    app.type === "desktop-application" ||
    app.type === "console-application" ||
    app.type === "desktop"
  )
}

export function isRuntimeAppstreamTypeGuard(
  app: GetAppstreamAppstreamAppIdGet200,
): app is GetAppstreamAppstreamAppIdGet200 & { type: "runtime" } {
  return app.type === "runtime"
}

export function getKeywords(app: GetAppstreamAppstreamAppIdGet200): string[] {
  if (!isDesktopAppstreamTypeGuard(app)) {
    return []
  }
  // Ensure keywords is an array (backend may send dict/object in some cases)
  const keywordsArray = Array.isArray(app.keywords) ? app.keywords : []
  // Remove duplicates
  const keywordSet = new Set(
    keywordsArray.map((keyword) => keyword.toLowerCase()),
  )

  if (!keywordSet.has("linux")) {
    keywordSet.add("linux")
  }

  if (!keywordSet.has("flatpak")) {
    keywordSet.add("flatpak")
  }

  return Array.from(keywordSet)
}
