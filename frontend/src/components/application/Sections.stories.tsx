import React from "react"
import { ComponentMeta } from "@storybook/react"
import Sections from "./Sections"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/Sections",
  component: Sections,
} as ComponentMeta<typeof Sections>

export const Generated = () => {
  const popular = [...Array(faker.datatype.number({ min: 1, max: 12 }))].map(
    (item, index) => ({
      id: index,
      icon: faker.image.image(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  const recentlyUpdated = [
    ...Array(faker.datatype.number({ min: 1, max: 12 })),
  ].map((item, index) => ({
    id: index,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }))

  const editorsChoiceApps = [
    ...Array(faker.datatype.number({ min: 1, max: 12 })),
  ].map((item, index) => ({
    id: index,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }))

  const recentlyAdded = [
    ...Array(faker.datatype.number({ min: 1, max: 12 })),
  ].map((item, index) => ({
    id: index,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }))

  return (
    <Sections
      popular={popular}
      recentlyUpdated={recentlyUpdated}
      editorsChoiceApps={editorsChoiceApps}
      recentlyAdded={recentlyAdded}
    />
  )
}
