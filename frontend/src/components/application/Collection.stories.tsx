import React from "react"
import { Meta } from "@storybook/react"
import Collection from "./Collection"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/Collection",
  component: Collection,
} as Meta<typeof Collection>

export const Generated = () => {
  const myApps = [...Array(faker.datatype.number({ min: 1, max: 12 }))].map(
    (item, index) => ({
      id: index,
      icon: faker.image.image(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  return <Collection applications={myApps} title={"My apps"} />
}
