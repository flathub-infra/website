import React from "react"
import { ComponentMeta } from "@storybook/react"
import Tile from "./Tile"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Tile",
  component: Tile,
} as ComponentMeta<typeof Tile>

export const CategoryTile = () => {
  return <Tile>{faker.commerce.department()}</Tile>
}
