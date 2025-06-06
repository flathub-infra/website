import type { Meta, StoryObj } from "@storybook/nextjs"

import { ApplicationSectionGradientMultiToggle } from "./ApplicationSectionGradientMultiToggle"
import { faker } from "@faker-js/faker"
import React from "react"
import { GameControllersLogo } from "../../../src/components/GameControllersLogo"

const meta = {
  component: ApplicationSectionGradientMultiToggle,
} satisfies Meta<typeof ApplicationSectionGradientMultiToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    apps: [
      {
        apps: {
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
        name: "games",
        moreLink: "/apps/category/game",
        moreLinkLabel: "more-game",
      },
      {
        apps: {
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
        name: "gameemulator",
        moreLink: "/apps/category/game/subcategories/Emulator",
        moreLinkLabel: "more-emulator",
      },
      {
        apps: {
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
        name: "gamelauncher",
        moreLink: "/apps/category/game/subcategories/Launcher",
        moreLinkLabel: "more-gamelauncher",
      },
      {
        apps: {
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
        name: "gametool",
        moreLink: "/apps/category/game/subcategories/Tool",
        moreLinkLabel: "more-gametool",
      },
    ],
    sectionKey: "games",
    title: "we-love-games",
    description: "game-section-description",
    logo: <GameControllersLogo />,
  },
}
