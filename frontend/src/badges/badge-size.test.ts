import { describe, expect, it } from "vitest"
import { BADGE_SIZES, parseBadgeSize } from "./badge-size"

describe("badge sizes", () => {
  it("keeps the existing badge as the default", () => {
    expect(parseBadgeSize(null)).toBe("default")
    expect(BADGE_SIZES.default).toMatchObject({
      canvasWidth: 240,
      canvasHeight: 80,
      badgeWidth: 240,
      badgeHeight: 80,
    })
  })

  it("provides a padded store-compatible badge", () => {
    expect(parseBadgeSize("padded")).toBe("padded")
    expect(BADGE_SIZES.padded).toMatchObject({
      canvasWidth: 308,
      canvasHeight: 119,
      badgeWidth: 269,
      badgeHeight: 80,
    })
    expect(
      BADGE_SIZES.padded.canvasWidth / BADGE_SIZES.padded.canvasHeight,
    ).toBeCloseTo(646 / 250, 1)
    expect(
      BADGE_SIZES.padded.badgeWidth / BADGE_SIZES.padded.badgeHeight,
    ).toBeCloseTo(3.36, 2)
  })

  it("rejects unknown badge sizes", () => {
    expect(parseBadgeSize("huge")).toBeNull()
  })
})
