import { beforeEach, describe, expect, it, vi } from "vitest"
import { getAppstreamAppstreamAppIdGet } from "../codegen/app/app"
import { getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet } from "../codegen/app-picks/app-picks"
import { getHomepageCuratedAppSelections } from "./curated-app-selections"

vi.mock("../codegen/app/app", () => ({
  getAppstreamAppstreamAppIdGet: vi.fn(),
}))
vi.mock("../codegen/app-picks/app-picks", () => ({
  getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet: vi.fn(),
}))

const getAppstream = vi.mocked(getAppstreamAppstreamAppIdGet)
const getSelections = vi.mocked(
  getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet,
)

describe("getHomepageCuratedAppSelections", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("preserves screenshot data for featured selections", async () => {
    const screenshots = [{ caption: "Preview", sizes: [] }]

    getSelections.mockResolvedValue({
      data: {
        selections: [
          {
            id: 1,
            theme_key: "free-software-favorites",
            slot: "after-hero",
            layout: "featured",
            starts_at: "2026-08-15",
            ends_at: "2026-08-22",
            apps: [
              {
                app_id: "org.example.App",
                position: 0,
                isFullscreen: true,
              },
            ],
          },
        ],
      },
    } as never)
    getAppstream.mockResolvedValue({
      data: {
        id: "org.example.App",
        name: "Example",
        summary: "An example app",
        screenshots,
      },
    } as never)

    const selections = await getHomepageCuratedAppSelections("2026-08-15", "en")

    expect(selections["after-hero"]).toMatchObject({
      layout: "featured",
      apps: [
        {
          id: "org.example.App",
          screenshots,
        },
      ],
    })
  })

  it("keeps editorial order while skipping unavailable apps", async () => {
    getSelections.mockResolvedValue({
      data: {
        selections: [
          {
            id: 1,
            theme_key: "spring-creativity",
            slot: "after-hero",
            layout: "featured",
            apps: [
              { app_id: "third", position: 2 },
              { app_id: "missing", position: 1 },
              { app_id: "first", position: 0 },
            ],
          },
        ],
      },
    } as never)
    getAppstream.mockImplementation(async (id) => {
      if (id === "missing") throw new Error("Unavailable")
      return { data: { id, name: id, summary: "Example" } } as never
    })

    const selections = await getHomepageCuratedAppSelections("2026-08-15", "de")

    expect(selections["after-hero"].apps.map((app) => app.id)).toEqual([
      "first",
      "third",
    ])
    expect(getAppstream).toHaveBeenCalledWith("first", { locale: "de" })
  })

  it("does not serialize screenshots for grid selections", async () => {
    getSelections.mockResolvedValue({
      data: {
        selections: [
          {
            id: 1,
            theme_key: "spring-creativity",
            slot: "after-hero",
            layout: "grid",
            apps: [{ app_id: "example", position: 0 }],
          },
        ],
      },
    } as never)
    getAppstream.mockResolvedValue({
      data: {
        id: "example",
        name: "Example",
        summary: "Example",
        screenshots: [{ sizes: [] }],
      },
    } as never)

    const selections = await getHomepageCuratedAppSelections("2026-08-15", "en")

    expect(selections["after-hero"].apps[0].screenshots).toBeUndefined()
  })

  it("omits empty selections and unknown slots", async () => {
    getSelections.mockResolvedValue({
      data: {
        selections: [
          { id: 1, slot: "after-hero", layout: "featured", apps: [] },
          {
            id: 2,
            slot: "unknown",
            layout: "featured",
            apps: [{ app_id: "example", position: 0 }],
          },
        ],
      },
    } as never)

    expect(await getHomepageCuratedAppSelections("2026-08-15", "en")).toEqual(
      {},
    )
    expect(getAppstream).not.toHaveBeenCalled()
  })

  it("falls back to no selections when the selection endpoint fails", async () => {
    getSelections.mockRejectedValue(new Error("Unavailable"))
    expect(await getHomepageCuratedAppSelections("2026-08-15", "en")).toEqual(
      {},
    )
  })
})
