import React from "react"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { UserInfoProvider } from "../../../src/context/user-info"

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
