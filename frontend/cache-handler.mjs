import { RedisStringsHandler } from "@trieb.work/nextjs-turbo-redis-cache"

const DEFAULT_MAX_APP_PAGE_CACHE_BYTES = 1_500_000
const maxAppPageCacheBytes = Number.parseInt(
  process.env.NEXT_CACHE_MAX_APP_PAGE_BYTES ??
    `${DEFAULT_MAX_APP_PAGE_CACHE_BYTES}`,
  10,
)

let sharedHandler = null

function getSerializedByteLength(data) {
  return Buffer.byteLength(JSON.stringify(data), "utf8")
}

function shouldSkipAppPageCache(key, data) {
  if (data?.kind !== "APP_PAGE") {
    return false
  }

  if (
    !Number.isSafeInteger(maxAppPageCacheBytes) ||
    maxAppPageCacheBytes <= 0
  ) {
    return false
  }

  const byteLength = getSerializedByteLength(data)
  if (byteLength <= maxAppPageCacheBytes) {
    return false
  }

  console.warn(
    `Skipping oversized APP_PAGE cache entry for ${key}: ${byteLength} bytes exceeds ${maxAppPageCacheBytes}`,
  )
  return true
}

function getHandler() {
  if (!sharedHandler) {
    sharedHandler = new RedisStringsHandler({
      database: 0,
      keyPrefix: "nextjs_",
      // L1 in-memory cache: 10 seconds (reduces Redis calls)
      inMemoryCachingTime: 10000,
      // Dedup identical Redis calls within same request
      redisGetDeduplication: true,
      // Batch tag operations
      revalidateTagQuerySize: 500,
      // Timeout for Redis operations
      getTimeoutMs: 500,
    })
  }
  return sharedHandler
}

class CacheHandler {
  constructor() {
    this.handler = getHandler()
  }

  async get(...args) {
    return this.handler.get(...args)
  }

  async set(key, data, ctx) {
    if (data?.kind === "APP_PAGE" && data?.status === 404) {
      ctx = { ...ctx, revalidate: 60 }
    }
    if (shouldSkipAppPageCache(key, data)) {
      return
    }
    return this.handler.set(key, data, ctx)
  }

  async revalidateTag(...args) {
    return this.handler.revalidateTag(...args)
  }

  resetRequestCache(...args) {
    return this.handler.resetRequestCache(...args)
  }
}

export default CacheHandler
