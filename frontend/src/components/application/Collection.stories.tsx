import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import Collection from "./Collection"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/Collection",
  component: Collection,
} as Meta<typeof Collection>

export const Generated = () => {
  const myApps = [...Array(faker.number.int({ min: 1, max: 12 }))].map(
    (item, index) => ({
      id: index,
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  return <Collection applications={myApps} title={"My apps"} />
}
