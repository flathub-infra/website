import { describe, expect, it } from "vitest"
import { formatContentRatingAge } from "./contentRating"

describe("formatContentRatingAge", () => {
  it("uses Latin digits independent of the site language", () => {
    expect(formatContentRatingAge(12)).toBe("\u206612+\u2069")
  })

  it("uses the minimum age when the rating is missing or lower", () => {
    expect(formatContentRatingAge(null)).toBe("\u20663+\u2069")
    expect(formatContentRatingAge(1)).toBe("\u20663+\u2069")
  })
})
