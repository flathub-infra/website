import { describe, expect, it } from "vitest"
import { findBiggestIcon } from "./Appstream"

const icons = [
  { height: 512, width: 512, scale: 1, url: "/512.png" },
  { height: 384, width: 384, scale: 2, url: "/768.png" },
  { height: 1000, width: 100, scale: 1, url: "/narrow.png" },
]

describe("findBiggestIcon", () => {
  it("uses effective pixel dimensions and does not mutate the list", () => {
    const input = [...icons]

    expect(findBiggestIcon(input)).toBe("/768.png")
    expect(input).toEqual(icons)
  })

  it("returns undefined for missing icons", () => {
    expect(findBiggestIcon(null)).toBeUndefined()
    expect(findBiggestIcon([])).toBeUndefined()
  })
})
