import {
  RedisStringsHandler,
  jsonCacheValueSerializer,
} from "@trieb.work/nextjs-turbo-redis-cache"
import { gzip, gunzip } from "node:zlib"
import { promisify } from "node:util"

const GZIP_VALUE_PREFIX = "gz:"
const DEFAULT_STALE_AGE_SECONDS = 30 * 60
const MAX_EXPIRE_AGE_SECONDS = 60 * 60
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

let sharedHandler = null

const gzipCacheValueSerializer = {
  async serialize(value) {
    const json = await jsonCacheValueSerializer.serialize(value)
    const compressed = await gzipAsync(Buffer.from(json, "utf8"))
    return `${GZIP_VALUE_PREFIX}${compressed.toString("base64")}`
  },
  async deserialize(stored) {
    if (!stored.startsWith(GZIP_VALUE_PREFIX)) {
      return null
    }

    const compressed = Buffer.from(
      stored.slice(GZIP_VALUE_PREFIX.length),
      "base64",
    )
    const json = (await gunzipAsync(compressed)).toString("utf8")
    return jsonCacheValueSerializer.deserialize(json)
  },
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
      defaultStaleAge: DEFAULT_STALE_AGE_SECONDS,
      estimateExpireAge: (staleAge) =>
        Math.min(staleAge * 2, MAX_EXPIRE_AGE_SECONDS),
      valueSerializer: gzipCacheValueSerializer,
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
