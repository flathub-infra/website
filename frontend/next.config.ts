import { PHASE_PRODUCTION_BUILD } from "next/constants"
import { withSentryConfig } from "@sentry/nextjs"
import createNextIntlPlugin from "next-intl/plugin"
import { NextConfig } from "next"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const CONTENT_SECURITY_POLICY = `
  base-uri 'self' ${process.env.NEXT_PUBLIC_SITE_BASE_URI};
  form-action 'none';
  style-src 'self' 'unsafe-inline' https://dl.flathub.org;
  font-src 'self';
  connect-src 'self' https://flathub.org https://flathub-vorarbeiter.apps.openshift.gnome.org/api/ https://webstats.gnome.org https://api.stripe.com https://maps.googleapis.com https://o467221.ingest.sentry.io/api/6610580/;
  img-src 'self' https://dl.flathub.org https://webstats.gnome.org https://avatars.githubusercontent.com https://gitlab.com https://gitlab.gnome.org https://lh3.googleusercontent.com https://secure.gravatar.com https://invent.kde.org data:;
  frame-ancestors 'none';
  frame-src 'self' https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com;
`

  .replace(/\s{2,}/g, " ")
  .trim()

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "flathub",
  project: "frontend",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: false,
}

const buildId = process.env.GITHUB_SHA

if (!buildId) {
  console.info(
    "No GITHUB_SHA environment variable found. Using the default Next.js buildId.",
  )
}

const nextConfig: (phase: string) => NextConfig = (phase) => ({
  output: "standalone",
  experimental: {
    scrollRestoration: true,
    globalNotFound: true,
    inlineCss: true,
  },
  serverExternalPackages: ["@resvg/resvg-js"],
  cacheHandler:
    process.env.NODE_ENV === "production"
      ? require.resolve("./cache-handler.mjs")
      : undefined,
  cacheMaxMemorySize: process.env.NODE_ENV === "production" ? 0 : undefined, // Disable in-memory caching in production
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
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/en/",
        permanent: true,
      },
      {
        source: "/apps/category/All/:page*",
        destination: "/en/",
        permanent: true,
      },
      {
        source: "/apps/search/:q",
        destination: "/en/apps/search?q=:q",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/en/",
        permanent: true,
      },
      {
        source: "/apps/:path*/flatpakhttps",
        destination:
          "flatpak+https://dl.flathub.org/repo/appstream/:path*.flatpakref",
        permanent: false,
      },
      {
        source: "/:locale/apps/:path*/flatpakhttps",
        destination:
          "flatpak+https://dl.flathub.org/repo/appstream/:path*.flatpakref",
        permanent: false,
      },
      {
        source: "/apps/details/:path*",
        destination: "/en/apps/:path*",
        permanent: true,
      },
      {
        source: "/apps/collection/verified",
        destination: "/en/apps/collection/verified/1",
        permanent: true,
      },
      {
        source: "/apps/collection/recently-updated",
        destination: "/en/apps/collection/recently-updated/1",
        permanent: true,
      },
      {
        source: "/apps/collection/recently-added",
        destination: "/en/apps/collection/recently-added/1",
        permanent: true,
      },
      {
        source: "/apps/collection/popular",
        destination: "/en/apps/collection/popular/1",
        permanent: true,
      },
      {
        source: "/apps/collection/trending",
        destination: "/en/apps/collection/trending/1",
        permanent: true,
      },
      {
        source: "/apps/collection/mobile",
        destination: "/en/apps/collection/mobile/1",
        permanent: true,
      },
      // Redirect non-localized app routes to localized ones (but not /apps itself)
      {
        source: "/apps/:path+",
        destination: "/en/apps/:path*",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/en/",
        permanent: true,
      },
      {
        source: "/apps/collection/developer/:developer",
        destination: "/en/apps/collection/developer/:developer/1",
        permanent: true,
      },
      {
        source: "/apps/category/:category",
        destination: "/en/apps/category/:category/1",
        permanent: true,
      },
      {
        source: "/apps/category/:category/subcategories/:subcategory",
        destination: "/en/apps/category/:category/subcategories/:subcategory/1",
        permanent: true,
      },
      {
        source: "/apps/collection/tag/:tag",
        destination: "/en/apps/collection/tag/:tag/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/developer/:developer",
        destination: "/:locale/apps/collection/developer/:developer/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/verified",
        destination: "/:locale/apps/collection/verified/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/recently-updated",
        destination: "/:locale/apps/collection/recently-updated/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/recently-added",
        destination: "/:locale/apps/collection/recently-added/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/popular",
        destination: "/:locale/apps/collection/popular/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/trending",
        destination: "/:locale/apps/collection/trending/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/mobile",
        destination: "/:locale/apps/collection/mobile/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/category/:category",
        destination: "/:locale/apps/category/:category/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/category/:category/subcategories/:subcategory",
        destination:
          "/:locale/apps/category/:category/subcategories/:subcategory/1",
        permanent: true,
      },
      {
        source: "/:locale/apps/collection/tag/:tag",
        destination: "/:locale/apps/collection/tag/:tag/1",
        permanent: true,
      },
      {
        source: "/pipelines",
        destination: "/en/builds",
        permanent: true,
      },
      {
        source: "/pipelines/:buildId",
        destination: "/en/builds/:buildId",
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*{/}?",
        headers: [
          {
            key: "X-Accel-Buffering",
            value: "no",
          },
        ],
      },
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
      {
        source: "/",
        headers: [
          {
            key: "Surrogate-Control",
            value:
              "max-age=3600, stale-while-revalidate=86400, stale-if-error=86400",
          },
        ],
      },
      {
        source: "/:locale/",
        headers: [
          {
            key: "Surrogate-Control",
            value:
              "max-age=3600, stale-while-revalidate=86400, stale-if-error=86400",
          },
        ],
      },
      {
        source: "/:locale/apps/(collection|category)/:path*",
        headers: [
          {
            key: "Surrogate-Control",
            value:
              "max-age=3600, stale-while-revalidate=86400, stale-if-error=86400",
          },
        ],
      },
      {
        source: "/:locale/apps/:path",
        headers: [
          {
            key: "Surrogate-Control",
            value:
              "max-age=3600, stale-while-revalidate=86400, stale-if-error=86400",
          },
          {
            key: "Surrogate-Key",
            value: `app-:path`,
          },
        ],
      },
    ]
  },
  generateBuildId: buildId
    ? async () => {
        return buildId
      }
    : undefined,
})

module.exports = async (phase) => {
  const config =
    process.env.ENABLE_SENTRY === "true"
      ? withSentryConfig(
          withNextIntl(nextConfig(phase)),
          sentryWebpackPluginOptions,
        )
      : withNextIntl(nextConfig(phase))

  return config
}
