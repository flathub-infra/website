// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import { isEmailConfirmRoute } from "src/utils/security"

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

const onEmailConfirmRoute = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false
  }
  try {
    return isEmailConfirmRoute(new URL(value, window.location.origin).pathname)
  } catch {
    return false
  }
}

const scrubRequestUrl = <T extends { request?: { url?: string } }>(
  event: T,
): T | null => {
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
}

// Magic links carry the sign-in token in the URL fragment, so keep replays
// off for sessions that start on the confirm page.
const directConfirmEntry =
  typeof window !== "undefined" && isEmailConfirmRoute(window.location.pathname)

Sentry.init({
  dsn:
    SENTRY_DSN ||
    "https://b512f563700847e787e978ae1c15133c@o467221.ingest.sentry.io/6610580",

  // Add optional integrations for additional features
  integrations: directConfirmEntry ? [] : [Sentry.replayIntegration()],

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

  beforeSend: scrubRequestUrl,
  beforeSendTransaction: scrubRequestUrl,

  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data
    if (
      data &&
      (onEmailConfirmRoute(data.from) ||
        onEmailConfirmRoute(data.to) ||
        onEmailConfirmRoute(data.url))
    ) {
      return null
    }
    return breadcrumb
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
