/**
 * Generated by orval 🍺
 * Do not edit manually.
 * Flathub API
 * OpenAPI spec version: 0.1.0
 */
import { HttpResponse, delay, http } from "msw"

export const getUpdateUpdatePostMockHandler = (
  overrideResponse?:
    | unknown
    | ((
        info: Parameters<Parameters<typeof http.post>[1]>[0],
      ) => Promise<unknown> | unknown),
) => {
  return http.post("*/update", async (info) => {
    await delay(1000)
    if (typeof overrideResponse === "function") {
      await overrideResponse(info)
    }
    return new HttpResponse(null, { status: 200 })
  })
}

export const getUpdateStatsUpdateStatsPostMockHandler = (
  overrideResponse?:
    | unknown
    | ((
        info: Parameters<Parameters<typeof http.post>[1]>[0],
      ) => Promise<unknown> | unknown),
) => {
  return http.post("*/update/stats", async (info) => {
    await delay(1000)
    if (typeof overrideResponse === "function") {
      await overrideResponse(info)
    }
    return new HttpResponse(null, { status: 200 })
  })
}

export const getProcessTransfersUpdateProcessPendingTransfersPostMockHandler = (
  overrideResponse?:
    | unknown
    | ((
        info: Parameters<Parameters<typeof http.post>[1]>[0],
      ) => Promise<unknown> | unknown),
) => {
  return http.post("*/update/process-pending-transfers", async (info) => {
    await delay(1000)
    if (typeof overrideResponse === "function") {
      await overrideResponse(info)
    }
    return new HttpResponse(null, { status: 200 })
  })
}
export const getUpdateMock = () => [
  getUpdateUpdatePostMockHandler(),
  getUpdateStatsUpdateStatsPostMockHandler(),
  getProcessTransfersUpdateProcessPendingTransfersPostMockHandler(),
]
