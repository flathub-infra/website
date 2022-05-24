const { i18n } = require("./next-i18next.config")
const nextSafe = require("next-safe")

const isDev = process.env.NODE_ENV !== "production"

module.exports = () => ({
  i18n,
  images: {
    domains: [
      "flathub.org",
      "dl.flathub.org",
      "avatars.githubusercontent.com",
      "gitlab.com",
      "gitlab.gnome.org",
      "lh3.googleusercontent.com",
      "secure.gravatar.com",
    ],
    swcMinify: true,
  },
  experimental: {
    outputStandalone: true,
  },
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: nextSafe({
          isDev,
          contentSecurityPolicy: {
            "base-uri": `'self' ${process.env.NEXT_PUBLIC_SITE_BASE_URI}`,
            "default-src": "none",
            "form-action": "none",
            "connect-src": `'self' ${process.env.NEXT_PUBLIC_API_BASE_URI} https://webstats.gnome.org;`,
            "img-src":
              "'self' https://dl.flathub.org https://webstats.gnome.org https://avatars.githubusercontent.com https://gitlab.com https://gitlab.gnome.org https://lh3.googleusercontent.com https://secure.gravatar.com data:;",
            "script-src": "'self' https://webstats.gnome.org/matomo.js",
            "style-src":
              "'self' 'unsafe-inline' https://dl.flathub.org/repo/assets/Inter-3.19/",
            "font-src": "'self' https://dl.flathub.org/repo/assets/",
            "frame-ancestors": "none",
          },
        }),
      },
    ]
  },
})
