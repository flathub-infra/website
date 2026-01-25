import { RedisStringsHandler } from "@trieb.work/nextjs-turbo-redis-cache"

let sharedHandler = null

function getHandler() {
  if (!sharedHandler) {
    sharedHandler = new RedisStringsHandler({
      database: 0,
      keyPrefix: 'nextjs_',
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

  async set(...args) {
    return this.handler.set(...args)
  }

  async revalidateTag(...args) {
    return this.handler.revalidateTag(...args)
  }

  resetRequestCache(...args) {
    return this.handler.resetRequestCache(...args)
  }
}

export default CacheHandler
