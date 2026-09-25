import { afterEach, describe, expect, it, vi } from "vitest"
import { login } from "./login"

vi.mock("../env", () => ({ LOGIN_PROVIDERS_URL: "/auth/login" }))
vi.mock("src/codegen", () => ({ getUserinfoAuthUserinfoGet: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("login callback errors", () => {
  it.each(["gitlab", "gnome", "kde"])(
    "preserves the actionable %s Terms of Service error",
    async (provider) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: "gitlab-terms-not-accepted" }),
        }),
      )
      const dispatch = vi.fn()

      await expect(
        login(dispatch, provider, { code: "code", state: "state" }),
      ).rejects.toThrow("gitlab-terms-not-accepted")
      expect(dispatch).toHaveBeenLastCalledWith({ type: "interrupt" })
    },
  )

  it("does not display unknown provider errors containing personal data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "403 Forbidden - You (@example) ..." }),
      }),
    )

    await expect(login(vi.fn(), "gitlab", {})).rejects.toThrow(
      "login-failed-try-again",
    )
  })
})
