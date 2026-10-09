import { describe, expect, it } from "vitest"
import {
  getDisplaySupport,
  getPlatformSupportStatus,
  isAdaptive,
  isAdaptiveForDeclaredHardware,
} from "./platform-support"

describe("isAdaptive", () => {
  it("requires touch, keyboard, and pointing support", () => {
    const supports = [
      { type: "control", value: "touch" },
      { type: "control", value: "keyboard" },
      { type: "control", value: "pointing" },
    ]

    expect(isAdaptive(undefined, undefined, supports)).toBe(true)
    expect(isAdaptive(undefined, supports, undefined)).toBe(true)
    expect(isAdaptive(undefined, undefined, supports.slice(0, 2))).toBe(false)
  })

  it("does not treat required controls as adaptive support", () => {
    expect(
      isAdaptive([{ type: "control", value: "keyboard" }], undefined, [
        { type: "control", value: "touch" },
        { type: "control", value: "pointing" },
      ]),
    ).toBe(false)
  })

  it("requires declared support for mobile and desktop displays", () => {
    const controls = [
      { type: "control", value: "touch" },
      { type: "control", value: "keyboard" },
      { type: "control", value: "pointing" },
    ]

    expect(isAdaptiveForDeclaredHardware(undefined, undefined, controls)).toBe(
      false,
    )
    expect(
      isAdaptiveForDeclaredHardware(undefined, undefined, [
        ...controls,
        { type: "display_length", value: "360", compare: "ge" },
      ]),
    ).toBe(true)
  })

  it("recognizes a minimum display requirement as applying to both categories", () => {
    const controls = [
      { type: "control", value: "touch" },
      { type: "control", value: "keyboard" },
      { type: "control", value: "pointing" },
    ]
    const minimumDisplayLength = [
      { type: "display_length", value: "360", compare: "ge" },
    ]

    expect(
      getDisplaySupport("mobile", minimumDisplayLength, undefined, undefined),
    ).toBe("required")
    expect(
      getDisplaySupport("desktop", minimumDisplayLength, undefined, undefined),
    ).toBe("required")
    expect(
      getPlatformSupportStatus(undefined, controls, [
        ...controls,
        ...minimumDisplayLength,
      ]),
    ).toBe("adaptive")
  })
})

describe("getDisplaySupport", () => {
  it("keeps display compatibility unknown when no display metadata is declared", () => {
    expect(getDisplaySupport("mobile", undefined, undefined, undefined)).toBe(
      "unknown",
    )
    expect(getDisplaySupport("desktop", undefined, undefined, undefined)).toBe(
      "unknown",
    )
  })

  it("uses explicit display requirements to distinguish mobile and desktop", () => {
    const requiresLargeScreen = [
      { type: "display_length", value: "1024", compare: "ge" },
    ]

    expect(
      getDisplaySupport("mobile", requiresLargeScreen, undefined, undefined),
    ).toBe("unsupported")
    expect(
      getDisplaySupport("desktop", requiresLargeScreen, undefined, undefined),
    ).toBe("required")
  })

  it("classifies an app restricted to large displays as desktop-only", () => {
    const largeScreenRequirement = [
      { type: "display_length", value: "1024", compare: "ge" },
    ]

    expect(
      getPlatformSupportStatus(largeScreenRequirement, undefined, undefined),
    ).toBe("desktop-only")
  })

  it("keeps display support unknown when there is no display metadata", () => {
    expect(getPlatformSupportStatus(undefined, undefined, undefined)).toBe(
      "unknown",
    )
  })
})
