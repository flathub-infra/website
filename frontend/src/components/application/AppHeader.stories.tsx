import React from "react"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { UserContext } from "../../../src/context/user-info"
import { expect, within } from "storybook/test"
import { http, HttpResponse } from "msw"
import { publicBookmarkCount, withSignedOutUser } from "./bookmark-story"

const meta = {
  component: AppHeader,
  title: "Components/Application/AppHeader",
  decorators: [withSignedOutUser],
  parameters: {
    msw: { handlers: [publicBookmarkCount] },
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof AppHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Install: Story = {
  args: {
    app: {
      type: "desktop-application",
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: "App name that's too long",
      developer_name: faker.internet.username(),
    },
    vendingSetup: undefined,
    verificationStatus: { verified: true, method: "manual" },
    isQualityModalOpen: false,
  },
}

export const InstallNotVerified: Story = {
  args: {
    app: {
      type: "desktop-application",
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
    },
    vendingSetup: undefined,
    verificationStatus: { verified: false },
    isQualityModalOpen: false,
  },
}

export const InstallWithDonate: Story = {
  play: async ({ canvasElement, globals }) => {
    const count = await within(canvasElement).findByText(
      new Intl.NumberFormat(globals.locale).format(674),
    )
    await expect(count.closest("a")).toHaveRole("link")
    await expect(count).toBeVisible()
  },
  args: {
    app: {
      type: "desktop-application",
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
      urls: { donation: faker.internet.url() },
    },
    vendingSetup: undefined,
    verificationStatus: {
      verified: true,
      method: "login_provider",
      login_provider: "github",
      login_name: "example",
    },
    isQualityModalOpen: false,
  },
}

export const WithVending: Story = {
  args: {
    app: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
      urls: { donation: faker.internet.url() },
    },
    vendingSetup: {
      recommended_donation: faker.number.int({ min: 1, max: 150 }),
    },
    verificationStatus: { verified: true },
    isQualityModalOpen: false,
  },
}

let bookmarked = true
export const WithVendingOwnedApp: Story = {
  beforeEach: () => {
    bookmarked = true
  },
  parameters: {
    msw: {
      handlers: [
        http.get("*/favorites/org.example.OwnedApp", () =>
          HttpResponse.json(bookmarked),
        ),
        http.get("*/favorites/org.example.OwnedApp/count/current", () =>
          HttpResponse.json({ favorites_count: bookmarked ? 675 : 674 }),
        ),
        http.post("*/favorites/org.example.OwnedApp/add", () => {
          bookmarked = true
          return new HttpResponse(null, { status: 200 })
        }),
        http.delete("*/favorites/org.example.OwnedApp/remove", () => {
          bookmarked = false
          return new HttpResponse(null, { status: 200 })
        }),
      ],
    },
  },
  args: {
    app: {
      id: "org.example.OwnedApp",
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: "Owned app",
      urls: { donation: "https://example.org/donate" },
    },
    vendingSetup: { recommended_donation: 5 },
    verificationStatus: { verified: true },
    isQualityModalOpen: false,
  },
  render: (args) => (
    <UserContext
      value={{
        loading: false,
        info: { owned_flatpaks: ["org.example.OwnedApp"] },
      }}
    >
      <AppHeader {...args} />
    </UserContext>
  ),
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement)
    const count = await canvas.findByText(
      new Intl.NumberFormat(globals.locale).format(675),
    )
    await expect(count).toBeVisible()
    await expect(count.closest("button")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    const links = canvas
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
    expect(links.some((href) => href?.includes("/apps/purchase/"))).toBe(false)
    expect(links).toContain("https://example.org/donate")
  },
}

export const WithQualityModalOpen: Story = {
  args: {
    app: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
    },
    vendingSetup: {
      recommended_donation: faker.number.int({ min: 1, max: 150 }),
    },
    verificationStatus: { verified: true },
    isQualityModalOpen: true,
  },
}
export const WithQualityModalOpenAndTooLongAppName: Story = {
  args: {
    app: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: "App name that's too long",
      developer_name: faker.internet.username(),
    },
    vendingSetup: {
      recommended_donation: faker.number.int({ min: 1, max: 150 }),
    },
    verificationStatus: { verified: true },
    isQualityModalOpen: true,
  },
}
