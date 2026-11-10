import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { getDistros } from "./distro-setup"

describe("distribution setup images", () => {
  it("references existing public image filenames with matching case", () => {
    for (const distro of getDistros()) {
      const path = new URL(distro.logo, "https://example.test").pathname
      const local = path.replace(/^\/assets\/_next\/public/, "")
      expect(existsSync(resolve("public", `.${local}`)), distro.name).toBe(true)
    }
  })
})
