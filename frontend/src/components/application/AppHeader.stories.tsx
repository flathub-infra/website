import React from "react"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { UserContext, UserInfoProvider } from "../../../src/context/user-info"
import { expect, within } from "storybook/test"

const meta = {
  component: AppHeader,
  title: "Components/Application/AppHeader",
  parameters: {
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
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: "App name that's too long",
      developer_name: faker.internet.username(),
    },
    vendingSetup: undefined,
    verificationStatus: { verified: true, method: "manual" },
    isQualityModalOpen: false,
  },
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const InstallNotVerified: Story = {
  args: {
    app: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
    },
    vendingSetup: undefined,
    verificationStatus: { verified: false },
    isQualityModalOpen: false,
  },
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const InstallWithDonate: Story = {
  args: {
    app: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      developer_name: faker.internet.username(),
      urls: { donation: faker.internet.url() },
    },
    vendingSetup: undefined,
    verificationStatus: { verified: true },
    isQualityModalOpen: false,
  },
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
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
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const WithVendingOwnedApp: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.queryByRole("link", { name: "Purchase" })).toBeNull()
    expect(canvas.getByRole("link", { name: "Donate" })).toBeInTheDocument()
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
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
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
  decorators: [
    (Story) => (
      <UserInfoProvider>
        <Story />
      </UserInfoProvider>
    ),
  ],
}
