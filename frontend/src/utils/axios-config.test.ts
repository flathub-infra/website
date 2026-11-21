import axios, { AxiosError, type AxiosAdapter } from "axios"
import { expect, test, vi } from "vitest"
import { getYearInReviewYearInReviewYearGet } from "../codegen/year-in-review/year-in-review"
import "./axios-config"

test("the archive deadline cancels an in-progress retry delay", async () => {
  vi.useFakeTimers()
  try {
    const controller = new AbortController()
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      throw new AxiosError("timed out", "ETIMEDOUT", config)
    })
    const result = getYearInReviewYearInReviewYearGet(
      2024,
      {},
      {
        adapter,
        signal: controller.signal,
      },
    ).catch((error) => axios.isCancel(error))
    setTimeout(() => controller.abort(), 1500)
    await vi.advanceTimersByTimeAsync(1500)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    await expect(result).resolves.toBe(true)
  } finally {
    vi.useRealTimers()
  }
})
