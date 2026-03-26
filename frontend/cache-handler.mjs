import { RedisStringsHandler } from "@trieb.work/nextjs-turbo-redis-cache"
import { zstdCompressSync, zstdDecompressSync } from "node:zlib"

const COMPRESSED_PREFIX = "zstd:"

let sharedHandler = null

function getHandler() {
  if (!sharedHandler) {
    sharedHandler = new RedisStringsHandler({
      database: 0,
      keyPrefix: "nextjs_",
      inMemoryCachingTime: 10000,
      redisGetDeduplication: true,
      revalidateTagQuerySize: 500,
      getTimeoutMs: 500,
    })
  }
  return sharedHandler
}

function compressData(data) {
  const json = JSON.stringify(data)
  const compressed = zstdCompressSync(json)
  return { body: COMPRESSED_PREFIX + compressed.toString("base64") }
}

function decompressData(data) {
  if (
    typeof data?.body === "string" &&
    data.body.startsWith(COMPRESSED_PREFIX)
  ) {
    const buf = Buffer.from(data.body.slice(COMPRESSED_PREFIX.length), "base64")
    return JSON.parse(zstdDecompressSync(buf).toString())
  }
  return data
}

class CacheHandler {
  constructor() {
    this.handler = getHandler()
  }

  async get(...args) {
    const result = await this.handler.get(...args)
    if (result?.value) {
      result.value = decompressData(result.value)
    }
    return result
  }

  async set(key, data, ctx) {
    if (data?.kind === "APP_PAGE" && data?.status === 404) {
      ctx = { ...ctx, revalidate: 60 }
    }
    return this.handler.set(key, compressData(data), ctx)
  }

  async revalidateTag(...args) {
    return this.handler.revalidateTag(...args)
  }

  resetRequestCache(...args) {
    return this.handler.resetRequestCache(...args)
  }
}

export default CacheHandler
