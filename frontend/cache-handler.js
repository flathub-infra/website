const { IncrementalCache } = require("@neshca/cache-handler")
const createRedisHandler =
  require("@neshca/cache-handler/redis-strings").default
const createLruHandler = require("@neshca/cache-handler/local-lru").default
const { createClient } = require("redis")

const client = createClient({
  url: "redis://localhost:6379", // based on backend/README.md
})

// Ignore Redis errors: https://github.com/redis/node-redis?tab=readme-ov-file#events
client.on("error", () => {})

IncrementalCache.onCreation(async () => {
  console.info("Connecting to Redis...")
  await client.connect()
  console.info("Connected to Redis.")

  const redisCache = await createRedisHandler({
    client,
    timeoutMs: 2000,
  })

  const localCache = createLruHandler({
    maxItemSizeBytes: 1000 * 1000 * 100, // approx 100 MB of RAM
  })

  return {
    cache: [redisCache, localCache],
    useFileSystem: true,
  }
})

module.exports = IncrementalCache
