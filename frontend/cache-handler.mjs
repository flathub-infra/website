//@ts-check
import { createClient } from "redis"
import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import { CacheHandler } from "@fortedigital/nextjs-cache-handler"
import createLruHandler from "@fortedigital/nextjs-cache-handler/local-lru"
import createRedisHandler from "@fortedigital/nextjs-cache-handler/redis-strings"

CacheHandler.onCreation(({ buildId }) => {
  if (!buildId) {
    return {
      handlers: [],
    }
  }

  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures only one instance get created
  if (global.cacheHandlerConfig) {
    return global.cacheHandlerConfig
  }

  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures new instances are not created in a race condition
  if (global.cacheHandlerConfigPromise) {
    return global.cacheHandlerConfigPromise
  }

  // Main promise initializing the handler
  global.cacheHandlerConfigPromise = (async () => {
    let redisClient = null

    if (PHASE_PRODUCTION_BUILD !== process.env.NEXT_PHASE) {
      const settings = {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
        pingInterval: 10000,
      }

      try {
        redisClient = createClient(settings)
        redisClient.on("error", (e) => {
          if (typeof process.env.NEXT_PRIVATE_DEBUG_CACHE !== "undefined") {
            console.warn("Redis error", e)
          }
          global.cacheHandlerConfig = null
          global.cacheHandlerConfigPromise = null
        })
      } catch (error) {
        console.warn("Failed to create Redis client:", error)
      }
    }

    if (redisClient) {
      try {
        console.info("Connecting Redis client...")
        await redisClient.connect()
        console.info("Redis client connected.")
      } catch (error) {
        console.warn("Failed to connect Redis client:", error)
        await redisClient
          .disconnect()
          .catch(() =>
            console.warn(
              "Failed to quit the Redis client after failing to connect.",
            ),
          )
      }
    }

    const lruCache = createLruHandler()

    if (!redisClient?.isReady) {
      console.error("Failed to initialize caching layer.")
      global.cacheHandlerConfigPromise = null
      global.cacheHandlerConfig = { handlers: [lruCache] }
      return global.cacheHandlerConfig
    }

    const redisCacheHandler = createRedisHandler({
      client: redisClient,
      keyPrefix: buildId,
      timeoutMs: 500,
    })

    global.cacheHandlerConfigPromise = null

    // This example uses composite handler to switch from Redis to LRU cache if tags contains `memory-cache` tag.
    // You can skip composite and use Redis or LRU only.
    global.cacheHandlerConfig = {
      handlers: [redisCacheHandler],
      ttl: { estimateExpireAge: (staleAge) => staleAge + 60 },
    }

    return global.cacheHandlerConfig
  })()

  return global.cacheHandlerConfigPromise
})

export default CacheHandler
