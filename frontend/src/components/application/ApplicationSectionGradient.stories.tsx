import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ApplicationSectionGradient } from "./ApplicationSectionGradient"
import { MobileDevicesLogo } from "../../../src/components/MobileDevicesLogo"
import { faker } from "@faker-js/faker"

const meta = {
  component: ApplicationSectionGradient,
} satisfies Meta<typeof ApplicationSectionGradient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    mobile: {
      hits: [
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
        {
          id: faker.string.uuid(),
          icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
          name: faker.commerce.product(),
          summary: faker.commerce.productDescription(),
        },
      ],
    },
    title: "On the go",
    description: "My description",
    logo: <MobileDevicesLogo />,
    moreLinkLabel: "More link",
    moreLink: "/apps/collection/mobile",
  },
}
