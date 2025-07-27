import { Meta, StoryObj } from "@storybook/nextjs-vite"
import ApplicationSection from "./ApplicationSection"
import { faker } from "@faker-js/faker"
import React from "react"

const meta: Meta<typeof ApplicationSection> = {
  title: "Components/Application/ApplicationSection",
  component: ApplicationSection,
}

export default meta
type Story = StoryObj<typeof ApplicationSection>

export const Generated: Story = {
  args: {
    type: "withTitle",
    href: "popular",
    title: "popular",
    applications: [...Array(faker.number.int({ min: 6, max: 30 }))].map(
      (_item, index) => ({
        id: index.toString(),
        icon: faker.image.url(),
        name: faker.commerce.product(),
        summary: faker.commerce.productDescription(),
      }),
    ),
    showMore: true,
    moreText: "more",
  },
}

export const WithCustomHeader: Story = {
  args: {
    type: "withCustomHeader",
    href: "popular",
    applications: [...Array(faker.number.int({ min: 6, max: 30 }))].map(
      (_item, index) => ({
        id: index.toString(),
        icon: faker.image.url(),
        name: faker.commerce.product(),
        summary: faker.commerce.productDescription(),
      }),
    ),
    showMore: true,
    moreText: "more",
    customHeader: <h1>Custom header</h1>,
  },
}

export const WithCustomHeaderAndTransparent: Story = {
  args: {
    type: "withCustomHeaderAndTransparent",
    href: "popular",
    applications: [...Array(faker.number.int({ min: 6, max: 30 }))].map(
      (_item, index) => ({
        id: index.toString(),
        icon: faker.image.url(),
        name: faker.commerce.product(),
        summary: faker.commerce.productDescription(),
      }),
    ),
    showMore: true,
    moreText: "more",
    customHeader: <h1>Custom header</h1>,
  },
}
