const { i18n } = require("./next-i18next.config")

module.exports = {
  i18n,
  images: {
    loader: "custom",
    domains: ["flathub.org", "dl.flathub.org"],
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
        headers: [
          {
            key: "X-Frame-Options",
            value: "Deny",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ]
  },
}
