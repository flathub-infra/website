import { describe, expect, it } from "vitest"
import { getSearchFacetValues } from "./search-facets"

describe("getSearchFacetValues", () => {
  it("does not repeat a selected facet retained while new results load", () => {
    const previousFacets = { true: 1, false: 1 }

    expect(getSearchFacetValues(previousFacets, ["true"])).toEqual([
      "true",
      "false",
    ])
  })
})
