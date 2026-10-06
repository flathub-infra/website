import { describe, expect, it } from "vitest"
import {
  filtersFromQueryState,
  filtersToQueryState,
  type SelectedSearchFilter,
} from "./search-params"

describe("search filter query state", () => {
  it("maps repeated URL values to selected filters", () => {
    expect(
      filtersFromQueryState({
        main_categories: ["Utility"],
        is_free_license: [],
        verification_verified: [],
        runtime: [],
        type: ["desktop-application"],
        arches: ["x86_64", "aarch64"],
      }),
    ).toEqual([
      { filterType: "arches", value: "aarch64" },
      { filterType: "arches", value: "x86_64" },
      { filterType: "main_categories", value: "Utility" },
      { filterType: "type", value: "desktop-application" },
    ])
  })

  it("groups and normalizes selected filters by URL parameter", () => {
    const filters: SelectedSearchFilter[] = [
      { filterType: "arches", value: "x86_64" },
      { filterType: "main_categories", value: "Utility" },
      { filterType: "arches", value: "x86_64" },
    ]

    expect(filtersToQueryState(filters)).toEqual({
      main_categories: ["Utility"],
      is_free_license: [],
      verification_verified: [],
      runtime: [],
      type: [],
      arches: ["x86_64"],
    })
  })

  it("clears all filter parameters when no filters are selected", () => {
    expect(filtersToQueryState([])).toEqual({
      main_categories: [],
      is_free_license: [],
      verification_verified: [],
      runtime: [],
      type: [],
      arches: [],
    })
  })
})
