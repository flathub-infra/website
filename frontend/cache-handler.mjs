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

function replacer(_key, value) {
  if (value instanceof Map) {
    return { __type: "Map", entries: [...value.entries()] }
  }
  return value
}

function reviver(_key, value) {
  if (value?.__type === "Map") {
    return new Map(value.entries)
  }
  return value
}

function compressData(data) {
  const json = JSON.stringify(data, replacer)
  const compressed = zstdCompressSync(json)
  return {
    kind: data.kind,
    status: data.status,
    body: COMPRESSED_PREFIX + compressed.toString("base64"),
  }
}

function decompressData(data) {
  if (
    typeof data?.body === "string" &&
    data.body.startsWith(COMPRESSED_PREFIX)
  ) {
    const buf = Buffer.from(data.body.slice(COMPRESSED_PREFIX.length), "base64")
    return JSON.parse(zstdDecompressSync(buf).toString(), reviver)
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
