const { PHASE_PRODUCTION_BUILD } = require("next/constants")
const { i18n } = require("./next-i18next.config")
const { withSentryConfig } = require("@sentry/nextjs")

const CONTENT_SECURITY_POLICY = `
  base-uri 'self' ${process.env.NEXT_PUBLIC_SITE_BASE_URI};
  default-src 'none';
  form-action 'none';
  script-src 'self' 'sha256-fDVtD703YIdPFRhb6ZJE/SvcwyA7gZRWfRRM6K6r9EA=' https://webstats.gnome.org https://js.stripe.com;
  style-src 'self' 'unsafe-inline' https://dl.flathub.org;
  font-src 'self';
  connect-src 'self' https://flathub.org https://webstats.gnome.org https://api.stripe.com https://o467221.ingest.sentry.io/api/6610580/;
  img-src 'self' https://dl.flathub.org https://webstats.gnome.org https://avatars.githubusercontent.com https://gitlab.com https://gitlab.gnome.org https://lh3.googleusercontent.com https://secure.gravatar.com https://invent.kde.org data:;
  frame-ancestors 'none';
  frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
`

  .replace(/\s{2,}/g, " ")
  .trim()

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = (phase) => ({
  output: "export",
  experimental: {
    scrollRestoration: true,
  },
  i18n,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flathub.org",
      },
      {
        protocol: "https",
        hostname: "dl.flathub.org",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "gitlab.com",
      },
      {
        protocol: "https",
        hostname: "gitlab.gnome.org",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "invent.kde.org",
      },
    ],
  },
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/apps/category/All/:page*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/",
        permanent: true,
      },
      {
        source: "/apps/search/:q",
        destination: "/apps/search?q=:q",
        permanent: true,
      },
      {
        source: "/apps/details/:path*",
        destination: "/apps/:path*",
        permanent: true,
      },
      {
        source: "/apps/collection/verified",
        destination: "/apps/collection/verified/1",
        permanent: true,
      },
      {
        source: "/apps/collection/recently-updated",
        destination: "/apps/collection/recently-updated/1",
        permanent: true,
      },
      {
        source: "/apps/collection/recently-added",
        destination: "/apps/collection/recently-added/1",
        permanent: true,
      },
      {
        source: "/apps/collection/popular",
        destination: "/apps/collection/popular/1",
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
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(self), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              /**
               * For testing adjustments use https://addons.mozilla.org/en-GB/firefox/addon/laboratory-by-mozilla/
               * (which allows you to overwrite the Content Security Policy of a particular website).
               *
               * Do not add `unsafe-inline` to `script-src`, as we are using dangerouslySetInnerHTML in a few places,
               * which makes us vulnerable to arbitrary code execution if we receive unsanitized data from the APIs.
               *
               * For the development environment we either need to maintain a separate CSP or disable it altogether.
               * This is because it makes use of `eval` and other features that we don't want to allow in the production environment.
               */
              phase === PHASE_PRODUCTION_BUILD ? CONTENT_SECURITY_POLICY : "",
          },
        ],
      },
    ]
  },
})

const sentryExports = (phase) => {
  return {
    ...nextConfig(phase),
    sentry: {
      // Use `hidden-source-map` rather than `source-map` as the Webpack `devtool`
      // for client-side builds. (This will be the default starting in
      // `@sentry/nextjs` version 8.0.0.) See
      // https://webpack.js.org/configuration/devtool/ and
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#use-hidden-source-map
      // for more information.
      hideSourceMaps: true,
      widenClientFileUpload: true,
    },
  }
}

module.exports = async (phase) => {
  /**
   * @type {import('next').NextConfig}
   */
  return process.env.ENABLE_SENTRY === "true"
    ? withSentryConfig(sentryExports(phase), sentryWebpackPluginOptions)
    : nextConfig(phase)
}
