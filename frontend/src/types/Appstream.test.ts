import { describe, expect, it } from "vitest"
import type { Screenshot } from "src/codegen"
import { screenshotsForTheme } from "./Appstream"

const screenshot = (environment?: string): Screenshot => ({
  environment,
  sizes: [{ width: "800", height: "600", src: "screenshot.png" }],
})

describe("screenshotsForTheme", () => {
  it("shows screenshots for the selected theme and unthemed screenshots", () => {
    const light = screenshot("light")
    const dark = screenshot("dark")
    const neutral = screenshot()

    expect(screenshotsForTheme([light, dark, neutral], "dark")).toEqual([
      dark,
      neutral,
    ])
  })

  it("shows all screenshots when no screenshot matches the selected theme", () => {
    const screenshots = [screenshot("dark")]

    expect(screenshotsForTheme(screenshots, "light")).toEqual(screenshots)
  })

  it("shows all screenshots when metadata has no theme variants", () => {
    const screenshots = [screenshot(), screenshot("mobile")]

    expect(screenshotsForTheme(screenshots, "dark")).toEqual(screenshots)
  })
})
