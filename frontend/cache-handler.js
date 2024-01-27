const { IncrementalCache } = require("@neshca/cache-handler")
const createRedisCache = require("@neshca/cache-handler/redis-stack").default
const createLruCache = require("@neshca/cache-handler/local-lru").default
const { createClient } = require("redis")

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
})

client.on("error", (error) => {
  console.error("Redis error:", error.message)
})

IncrementalCache.onCreation(async () => {
  function useTtl(maxAge) {
    const evictionAge = maxAge * 2

    return evictionAge
  }

  await client.connect()

  const redisCache = await createRedisCache({
    client,
    useTtl,
  })

  const localCache = createLruCache({
    useTtl,
  })

  return {
    cache: [redisCache, localCache],
    useFileSystem: false,
  }
})

module.exports = IncrementalCache
