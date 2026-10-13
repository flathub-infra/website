import { AxiosError, type AxiosResponse } from "axios"
import { describe, expect, it, vi } from "vitest"
import { isReauthenticationRequired, runWithReauth } from "./reauth"

function reauthenticationError() {
  return new AxiosError(
    "Reauthentication required",
    undefined,
    undefined,
    undefined,
    {
      status: 403,
      data: { detail: "reauthentication_required" },
    } as AxiosResponse,
  )
}

describe("runWithReauth", () => {
  it("returns success without opening a dialog", async () => {
    const action = vi.fn().mockResolvedValue("done")
    const reauthenticate = vi.fn()

    await expect(runWithReauth(action, reauthenticate)).resolves.toBe("done")
    expect(action).toHaveBeenCalledTimes(1)
    expect(reauthenticate).not.toHaveBeenCalled()
  })

  it("propagates other errors without opening a dialog", async () => {
    const errors = [
      new Error("failed"),
      {
        response: {
          status: 403,
          data: { detail: "reauthentication_required" },
        },
      },
      new AxiosError("Forbidden", undefined, undefined, undefined, {
        status: 403,
        data: { detail: "other_error" },
      } as AxiosResponse),
      new AxiosError("Unauthorized", undefined, undefined, undefined, {
        status: 401,
        data: { detail: "reauthentication_required" },
      } as AxiosResponse),
    ]
    const reauthenticate = vi.fn()

    for (const error of errors) {
      expect(isReauthenticationRequired(error)).toBe(false)
      await expect(
        runWithReauth(() => Promise.reject(error), reauthenticate),
      ).rejects.toBe(error)
    }
    expect(reauthenticate).not.toHaveBeenCalled()
  })

  it("retries once after successful reauthentication", async () => {
    const error = reauthenticationError()
    const action = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("done")
    const reauthenticate = vi.fn().mockResolvedValue(true)

    expect(isReauthenticationRequired(error)).toBe(true)
    await expect(runWithReauth(action, reauthenticate)).resolves.toBe("done")
    expect(action).toHaveBeenCalledTimes(2)
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })

  it("returns undefined without retrying after cancellation", async () => {
    const action = vi.fn().mockRejectedValue(reauthenticationError())
    const reauthenticate = vi.fn().mockResolvedValue(false)

    await expect(runWithReauth(action, reauthenticate)).resolves.toBeUndefined()
    expect(action).toHaveBeenCalledTimes(1)
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })

  it("propagates a failed retry without opening another dialog", async () => {
    const error = reauthenticationError()
    const action = vi.fn().mockRejectedValue(error)
    const reauthenticate = vi.fn().mockResolvedValue(true)

    await expect(runWithReauth(action, reauthenticate)).rejects.toBe(error)
    expect(action).toHaveBeenCalledTimes(2)
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })
})
