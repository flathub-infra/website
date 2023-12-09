/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org",
  generateRobotsTxt: true,
  exclude: ["/server-sitemap-index.xml"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
      {
        userAgent: "Google-Extended",
        disallow: ["/"],
      },
      {
        userAgent: "anthropic-ai",
        disallow: ["/"],
      },
      {
        userAgent: "Omgilibot",
        disallow: ["/"],
      },
      {
        userAgent: "Omgili",
        disallow: ["/"],
      },
      {
        userAgent: "FacebookBot",
        disallow: ["/"],
      },
    ],
    additionalSitemaps: [
      `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/server-sitemap-index.xml`,
    ],
  },
}
