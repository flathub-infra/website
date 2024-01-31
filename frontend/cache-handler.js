//@ts-check

const { IncrementalCache } = require("@neshca/cache-handler")
const createRedisHandler =
  require("@neshca/cache-handler/redis-strings").default
const createLruHandler = require("@neshca/cache-handler/local-lru").default
const { createClient } = require("redis")

IncrementalCache.onCreation(async ({ buildId }) => {
  let redisHandler

  if (buildId) {
    /** @type {import('redis').RedisClientType} */
    const client = createClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    })

    // Ignore Redis errors: https://github.com/redis/node-redis?tab=readme-ov-file#events
    client.on("error", () => {})

    console.info("Connecting to Redis...")
    await client.connect()
    console.info("Connected to Redis.")

    const keyPrefix = `nextjs-cache:${buildId}:`

    redisHandler = await createRedisHandler({
      client,
      timeoutMs: 2000,
      keyPrefix,
    })
  }

  const localHandler = createLruHandler({
    // approx 100 MB of RAM as a backup if Redis fails
    maxItemSizeBytes: 1000 * 1000 * 100,
  })

  return {
    cache: [redisHandler, localHandler],
    useFileSystem: true,
  }
})

module.exports = IncrementalCache
