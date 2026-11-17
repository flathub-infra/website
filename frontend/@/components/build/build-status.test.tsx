import { describe, expect, it } from "vitest"
import { PipelineStatus } from "src/codegen-pipeline"
import { isPipelineStatusWithAll, statuses } from "./build-status-filter"
import {
  getDashboardStatusLabel,
  getStatusDescription,
  getStatusLabel,
  getStatusVariant,
} from "./build-status"

describe("pipeline status compatibility", () => {
  it("accepts every API status as a filter", () => {
    for (const status of Object.values(PipelineStatus)) {
      expect(statuses).toContain(status)
      expect(isPipelineStatusWithAll(status)).toBe(true)
    }
    expect(isPipelineStatusWithAll("all")).toBe(true)
    expect(isPipelineStatusWithAll("unknown")).toBe(false)
  })

  it("describes expired builds", () => {
    expect(getStatusLabel("expired")).toBe("Expired")
    expect(getDashboardStatusLabel("expired")).toBe("Expired")
    expect(getStatusDescription("expired")).not.toBe(
      "Status information unavailable",
    )
    expect(getStatusVariant("expired")).toBe("outline")
  })
})
