// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn:
    SENTRY_DSN ||
    "https://b512f563700847e787e978ae1c15133c@o467221.ingest.sentry.io/6610580",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.03,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
