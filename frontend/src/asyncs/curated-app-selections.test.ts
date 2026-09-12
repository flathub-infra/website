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

  it("preserves hero data and fullscreen state for carousel selections", async () => {
    const branding = { light: ["#ffffff"], dark: ["#000000"] }
    const screenshots = [{ caption: "Preview", sizes: [] }]

    getSelections.mockResolvedValue({
      data: {
        selections: [
          {
            id: 1,
            theme_key: "free-software-favorites",
            slot: "after-hero",
            layout: "carousel",
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
        branding,
        screenshots,
      },
    } as never)

    const selections = await getHomepageCuratedAppSelections("2026-08-15", "en")

    expect(selections["after-hero"]).toMatchObject({
      layout: "carousel",
      apps: [
        {
          id: "org.example.App",
          isFullscreen: true,
          branding,
          screenshots,
        },
      ],
    })
  })
})
