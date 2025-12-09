import { createClient } from "redis"
import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import { CacheHandler } from "@fortedigital/nextjs-cache-handler"
import createLruHandler from "@fortedigital/nextjs-cache-handler/local-lru"
import createRedisHandler from "@fortedigital/nextjs-cache-handler/redis-strings"

// Wrapper to add logging to cache operations
function createLoggingWrapper(handler, handlerName) {
  return {
    ...handler,
    async get(key, options) {
      const result = await handler.get(key, options)
      if (result) {
        console.log(`[Cache ${handlerName}] HIT: ${key}`)
      } else {
        console.log(`[Cache ${handlerName}] MISS: ${key}`)
      }
      return result
    },
    async set(key, data, options) {
      console.log(`[Cache ${handlerName}] SET: ${key}`)
      return await handler.set(key, data, options)
    },
  }
}

CacheHandler.onCreation(({ buildId }) => {
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

  // Use buildId for cache key prefix to enable cache invalidation on new deployments
  const keyPrefix = buildId ? `${buildId}:` : "nextjs:"

  // You may need to ignore Redis locally, remove this block otherwise
  if (process.env.NODE_ENV === "development") {
    const lruCache = createLruHandler()
    global.cacheHandlerConfig = { handlers: [lruCache] }
    return global.cacheHandlerConfig
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
        redisClient = null
      }
    }

    const lruCache = createLruHandler()

    if (!redisClient?.isReady) {
      console.error("Failed to initialize caching layer.")
      global.cacheHandlerConfigPromise = null
      global.cacheHandlerConfig = {
        handlers: [createLoggingWrapper(lruCache, "LRU")],
      }
      return global.cacheHandlerConfig
    }

    const redisCacheHandler = createRedisHandler({
      client: redisClient,
      keyPrefix: keyPrefix,
    })

    global.cacheHandlerConfigPromise = null
    global.cacheHandlerConfig = {
      handlers: [createLoggingWrapper(redisCacheHandler, "Redis")],
    }

    return global.cacheHandlerConfig
  })()

  return global.cacheHandlerConfigPromise
})

export default CacheHandler
