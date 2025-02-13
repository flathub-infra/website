import { sanitize } from "isomorphic-dompurify"
import { Appstream, Branding } from "src/types/Appstream"

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

export const translatePlatformName = (platform: string) => {
  switch (platform) {
    case "org.freedesktop.Platform":
    case "org-freedesktop-Platform":
      return "platform.org-freedesktop-platform"
    case "org.gnome.Platform":
    case "org-gnome-Platform":
      return "platform.org-gnome-platform"
    case "org.kde.Platform":
    case "org-kde-Platform":
      return "platform.org-kde-platform"
    default:
      return platform
  }
}

export const sanitizeAppstreamDescription = (str: string) => {
  return sanitize(str, {
    ALLOWED_TAGS: ["p", "ul", "li", "ol", "em", "code"],
    ALLOWED_ATTR: [],
  })
}

function hexToRgb(hex: string) {
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

  return branding.find((a) => a.scheme_preference === undefined)
}

export function getKeywords(app: Appstream): string[] {
  if (app.type === "addon") {
    return []
  }
  // Remove duplicates
  const keywordSet = new Set(
    (app.keywords ?? []).map((keyword) => keyword.toLowerCase()),
  )

  if (!keywordSet.has("linux")) {
    keywordSet.add("linux")
  }

  if (!keywordSet.has("flatpak")) {
    keywordSet.add("flatpak")
  }

  const keywords = Array.from(keywordSet)
  return keywords
}
