import type { MetadataRoute } from "next"
import { IS_PRODUCTION } from "src/env"

const siteUrl = process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Omgilibot", disallow: "/" },
      { userAgent: "Omgili", disallow: "/" },
      { userAgent: "FacebookBot", disallow: "/" },
      {
        userAgent: "*",
        allow: IS_PRODUCTION ? "/" : undefined,
        disallow: IS_PRODUCTION ? undefined : "/",
      },
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
