// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn:
    SENTRY_DSN ||
    "https://b512f563700847e787e978ae1c15133c@o467221.ingest.sentry.io/6610580",

  sampleRate: 0.1,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.03,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  // integrations: [
  //   new Sentry.Replay({
  //     // Additional Replay configuration goes in here, for example:
  //     maskAllText: true,
  //     blockAllMedia: true,
  //   }),
  // ],
})
