//@ts-check

import { CacheHandler } from "@neshca/cache-handler"
import createRedisHandler from "@neshca/cache-handler/redis-strings"
import createFallbackHandler from "@neshca/cache-handler/local-lru"
import { promiseWithTimeout } from "@neshca/cache-handler/helpers"
import { createClient } from "redis"

CacheHandler.onCreation(async ({ buildId }) => {
  if (!buildId) {
    return {
      handlers: [],
    }
  }

  const client = createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  })

  // Ignore Redis errors: https://github.com/redis/node-redis?tab=readme-ov-file#events
  client.on("error", () => {})

  let handler

  try {
    console.info("Connecting to Redis...")

    await promiseWithTimeout(client.connect(), 1000)

    console.info("Connected to Redis.")

    handler = createRedisHandler({
      client,
      keyPrefix: buildId,
      timeoutMs: 500,
    })
  } catch (error) {
    if (client.isOpen) {
      await client.disconnect()
    }

    console.warn("Failed to connect to Redis:", error)

    console.warn("Falling back to local LRU cache.")

    handler = createFallbackHandler()
  }

  return {
    handlers: [handler],
    ttl: {
      estimateExpireAge: (staleAge) => staleAge + 60,
    },
  }
})

export default CacheHandler
