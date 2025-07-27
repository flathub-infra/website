import { ApplicationCard } from "./ApplicationCard"
import { faker } from "@faker-js/faker"

import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta: Meta<typeof ApplicationCard> = {
  title: "Components/ApplicationCard",
  component: ApplicationCard,
}

export default meta
type Story = StoryObj<typeof ApplicationCard>

export const Primary: Story = {
  args: {
    application: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    },
  },
}

export const inACard: Story = {
  args: {
    application: {
      id: faker.string.uuid(),
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    },
    variant: "nested",
  },
}
