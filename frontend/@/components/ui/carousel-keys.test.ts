import { describe, expect, it } from "vitest"
import { getArrowKeyAction } from "./carousel-keys"

describe("getArrowKeyAction", () => {
  it("moves ArrowLeft to previous and ArrowRight to next in LTR", () => {
    expect(getArrowKeyAction("ArrowLeft", "ltr")).toBe("prev")
    expect(getArrowKeyAction("ArrowRight", "ltr")).toBe("next")
    expect(getArrowKeyAction("ArrowLeft")).toBe("prev")
    expect(getArrowKeyAction("ArrowRight")).toBe("next")
  })

  it("reverses the arrow keys in RTL", () => {
    expect(getArrowKeyAction("ArrowLeft", "rtl")).toBe("next")
    expect(getArrowKeyAction("ArrowRight", "rtl")).toBe("prev")
  })

  it("ignores other keys", () => {
    expect(getArrowKeyAction("ArrowUp", "rtl")).toBeNull()
    expect(getArrowKeyAction("Enter", "ltr")).toBeNull()
  })
})
