import {
  RedisStringsHandler,
  jsonCacheValueSerializer,
} from "@trieb.work/nextjs-turbo-redis-cache"
import { brotliCompress, brotliDecompress } from "node:zlib"
import { promisify } from "node:util"

const BROTLI_VALUE_PREFIX = "br:"
const DEFAULT_STALE_AGE_SECONDS = 30 * 60
const MAX_EXPIRE_AGE_SECONDS = 60 * 60
const brotliCompressAsync = promisify(brotliCompress)
const brotliDecompressAsync = promisify(brotliDecompress)

let sharedHandler = null

const brotliCacheValueSerializer = {
  async serialize(value) {
    const json = await jsonCacheValueSerializer.serialize(value)
    const compressed = await brotliCompressAsync(Buffer.from(json, "utf8"))
    return `${BROTLI_VALUE_PREFIX}${compressed.toString("base64")}`
  },
  async deserialize(stored) {
    if (!stored.startsWith(BROTLI_VALUE_PREFIX)) {
      return null
    }

    const compressed = Buffer.from(
      stored.slice(BROTLI_VALUE_PREFIX.length),
      "base64",
    )
    const json = (await brotliDecompressAsync(compressed)).toString("utf8")
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
      valueSerializer: brotliCacheValueSerializer,
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
