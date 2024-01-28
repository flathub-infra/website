const { IncrementalCache } = require("@neshca/cache-handler")
const createLruCache = require("@neshca/cache-handler/local-lru").default
const {
  reviveFromBase64Representation,
  replaceJsonWithBase64,
} = require("@neshca/json-replacer-reviver")
const { createClient } = require("redis")

const REVALIDATED_TAGS_KEY = "sharedRevalidatedTags"

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
})

client.on("error", (error) => {
  console.error("Redis error:", error)
})

IncrementalCache.onCreation(async () => {
  const useTtl = true

  await client.connect()

  const localCache = createLruCache({
    useTtl,
  })

  function assertClientIsReady() {
    if (!client.isReady) {
      throw new Error("Redis client is not ready")
    }
  }
  const redisCache = {
    name: "custom-redis-strings",
    async get(key) {
      assertClientIsReady()

      const result = await client.get(key)

      if (!result) {
        return null
      }

      return JSON.parse(result, reviveFromBase64Representation)
    },
    async set(key, value, ttl) {
      assertClientIsReady()

      await client.set(key, JSON.stringify(value, replaceJsonWithBase64), {
        EX: 1800,
      })
    },
    async getRevalidatedTags() {
      assertClientIsReady()

      const sharedRevalidatedTags = await client.hGetAll(REVALIDATED_TAGS_KEY)

      const entries = Object.entries(sharedRevalidatedTags)

      const revalidatedTags = entries.reduce((acc, [tag, revalidatedAt]) => {
        acc[tag] = Number(revalidatedAt)
        return acc
      }, {})

      return revalidatedTags
    },
    async revalidateTag(tag, revalidatedAt) {
      assertClientIsReady()

      await client.hSet(REVALIDATED_TAGS_KEY, {
        [tag]: revalidatedAt,
      })
    },
  }

  return {
    cache: [redisCache, localCache],
    useFileSystem: !useTtl,
  }
})

module.exports = IncrementalCache
