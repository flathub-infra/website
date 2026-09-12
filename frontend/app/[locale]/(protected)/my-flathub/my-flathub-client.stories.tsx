import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { expect, userEvent, waitFor, within } from "storybook/test"

import {
  UserContext,
  UserDispatchContext,
} from "../../../../src/context/user-info"
import MyFlathubClient from "./my-flathub-client"

const availableAppId = "tv.kodi.Kodi"
const unavailableAppId = "org.example.Unavailable"
let favoriteIds: string[] = []

const meta = {
  title: "pages/my-flathub",
  component: MyFlathubClient,
  args: {
    locale: "en",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    msw: {
      handlers: [
        http.get("*/favorites", () =>
          HttpResponse.json(
            favoriteIds.map((appId) => ({
              app_id: appId,
              created_at: "2024-01-01T00:00:00Z",
            })),
          ),
        ),
        http.get("*/appstream/:appId", ({ params }) => {
          if (params.appId === unavailableAppId) {
            return new HttpResponse(null, { status: 404 })
          }

          return HttpResponse.json({
            id: availableAppId,
            name: "Kodi",
            summary: "A media player",
            icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          })
        }),
        http.delete("*/favorites/:appId/remove", ({ params }) => {
          favoriteIds = favoriteIds.filter((appId) => appId !== params.appId)
          return new HttpResponse(null, { status: 200 })
        }),
      ],
    },
  },
  decorators: [
    (Story) => (
      <UserContext value={{ loading: false, info: { owned_flatpaks: [] } }}>
        <UserDispatchContext value={() => undefined}>
          <Story />
        </UserDispatchContext>
      </UserContext>
    ),
  ],
  beforeEach: () => {
    favoriteIds = [availableAppId, unavailableAppId]
  },
} satisfies Meta<typeof MyFlathubClient>

export default meta

type Story = StoryObj<typeof meta>

export const WithUnavailableFavorite: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const removeButton = await canvas.findByRole("button", {
      name: `Remove ${unavailableAppId} from bookmarks`,
    })

    await userEvent.click(removeButton)

    await waitFor(() => {
      expect(
        canvas.queryByRole("link", { name: unavailableAppId }),
      ).not.toBeInTheDocument()
    })
    expect(canvas.getByRole("link", { name: "Kodi" })).toBeInTheDocument()
  },
}
