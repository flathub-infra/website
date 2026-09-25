// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

const isEmailConfirmRoute = (pathname: string): boolean =>
  /^\/[a-z]{2,3}(?:-[A-Za-z]{2,4})?\/login\/email\/confirm\/?$/.test(pathname)

const directConfirmEntry =
  typeof window !== "undefined" && isEmailConfirmRoute(window.location.pathname)

if (!directConfirmEntry) {
  Sentry.init({
    dsn:
      SENTRY_DSN ||
      "https://b512f563700847e787e978ae1c15133c@o467221.ingest.sentry.io/6610580",

    // Add optional integrations for additional features
    integrations: [Sentry.replayIntegration()],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.1,
    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to 10%. You may want to set this to 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 0.1,

    // Setting this option to true will print useful information to the console while you're setting up.
    debug: false,

    beforeSend(event) {
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          url.hash = ""
          if (isEmailConfirmRoute(url.pathname)) {
            return null
          }
          event.request.url = url.toString()
        } catch {
          return event
        }
      }
      return event
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
