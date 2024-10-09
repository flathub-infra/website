import React from "react"
import { Meta } from "@storybook/react"
import ApplicationSection from "./ApplicationSection"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/ApplicationSection",
  component: ApplicationSection,
} as Meta<typeof ApplicationSection>

export const Generated = () => {
  const popular = [...Array(faker.number.int({ min: 1, max: 30 }))].map(
    (_item, index) => ({
      id: index.toString(),
      icon: faker.image.url(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  return (
    <ApplicationSection
      type="withTitle"
      href={"popular"}
      title={"popular"}
      applications={popular}
      showMore={true}
      moreText={"more"}
    />
  )
}
