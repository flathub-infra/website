import { createClient } from "redis"
import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import { CacheHandler } from "@fortedigital/nextjs-cache-handler"
import createLruHandler from "@fortedigital/nextjs-cache-handler/local-lru"
import createRedisHandler from "@fortedigital/nextjs-cache-handler/redis-strings"
import createCompositeHandler from "@fortedigital/nextjs-cache-handler/composite"

const isSingleConnectionModeEnabled = !!process.env.REDIS_SINGLE_CONNECTION

async function setupRedisClient() {
  if (PHASE_PRODUCTION_BUILD !== process.env.NEXT_PHASE) {
    try {
      const redisClient = createClient({
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
        pingInterval: 10000,
      })

      redisClient.on("error", (e) => {
        if (process.env.NEXT_PRIVATE_DEBUG_CACHE !== undefined) {
          console.warn("Redis error", e)
        }
        if (isSingleConnectionModeEnabled) {
          global.cacheHandlerConfig = null
          global.cacheHandlerConfigPromise = null
        }
      })

      console.info("Connecting Redis client...")
      await redisClient.connect()
      console.info("Redis client connected.")

      if (!redisClient.isReady) {
        console.error("Failed to initialize caching layer.")
      }

      return redisClient
    } catch (error) {
      console.warn("Failed to connect Redis client:", error)
      if (redisClient) {
        try {
          redisClient.destroy()
        } catch (e) {
          console.error(
            "Failed to quit the Redis client after failing to connect.",
            e,
          )
        }
      }
    }
  }

  return null
}

async function createCacheConfig(buildId) {
  const redisClient = await setupRedisClient()
  const lruCache = createLruHandler()

  if (!redisClient) {
    const config = { handlers: [lruCache] }
    if (isSingleConnectionModeEnabled) {
      global.cacheHandlerConfigPromise = null
      global.cacheHandlerConfig = config
    }
    return config
  }

  const redisCacheHandler = createRedisHandler({
    client: redisClient,
    keyPrefix: buildId + ":",
  })

  const config = {
    handlers: [
      createCompositeHandler({
        handlers: [lruCache, redisCacheHandler],
        setStrategy: (ctx) => (ctx?.tags.includes("memory-cache") ? 0 : 1),
      }),
    ],
  }

  if (isSingleConnectionModeEnabled) {
    global.cacheHandlerConfigPromise = null
    global.cacheHandlerConfig = config
  }

  return config
}

CacheHandler.onCreation(({ buildId }) => {
  if (!buildId) {
    return {
      handlers: [],
    }
  }
  if (isSingleConnectionModeEnabled) {
    if (global.cacheHandlerConfig) {
      return global.cacheHandlerConfig
    }
    if (global.cacheHandlerConfigPromise) {
      return global.cacheHandlerConfigPromise
    }
  }

  if (process.env.NODE_ENV === "development") {
    const config = { handlers: [createLruHandler()] }
    if (isSingleConnectionModeEnabled) {
      global.cacheHandlerConfig = config
    }
    return config
  }

  const promise = createCacheConfig(buildId)
  if (isSingleConnectionModeEnabled) {
    global.cacheHandlerConfigPromise = promise
  }
  return promise
})

export default CacheHandler
