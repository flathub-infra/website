import { describe, expect, it } from "vitest"
import { compareVersions, formatRuntimeLabel } from "./statistics-chart-utils"

describe("statistics chart labels", () => {
  it.each([
    ["org.gnome.Platform/x86_64/47", "GNOME Platform 47"],
    ["org.freedesktop.Platform/aarch64/24.08", "Freedesktop Platform 24.08"],
    ["org.kde.Platform/x86_64/6.9", "KDE Platform 6.9"],
  ])("shortens %s for the axis", (runtime, expected) => {
    expect(formatRuntimeLabel(runtime)).toBe(expected)
  })

  it("orders version labels numerically so colors do not depend on data rank", () => {
    expect(["1.16", "1.9", "1.12"].sort(compareVersions)).toEqual([
      "1.9",
      "1.12",
      "1.16",
    ])
  })
})
