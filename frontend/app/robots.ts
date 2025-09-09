import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "CCBot",
        disallow: "/",
      },
      {
        userAgent: "Google-Extended",
        disallow: "/",
      },
      {
        userAgent: "anthropic-ai",
        disallow: "/",
      },
      {
        userAgent: "Omgilibot",
        disallow: "/",
      },
      {
        userAgent: "Omgili",
        disallow: "/",
      },
      {
        userAgent: "FacebookBot",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    host: process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org",

    sitemap: [
      `${process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"}/sitemap.xml`,
      `${process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"}/server-sitemap-index.xml`,
    ],
  }
}
