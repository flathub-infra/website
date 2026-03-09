import * as Sentry from "@sentry/nextjs"
import { setCacheHandler } from "next/cache"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production") {
      const { default: CacheHandler } = await import("./cache-handler.mjs")
      setCacheHandler(new CacheHandler())
    }

    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
