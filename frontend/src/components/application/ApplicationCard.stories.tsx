import React from "react"
import { ComponentMeta } from "@storybook/react"
import ApplicationCard from "./ApplicationCard"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/Application/ApplicationCard",
  component: ApplicationCard,
} as ComponentMeta<typeof ApplicationCard>

export const Generated = () => {
  const application = {
    id: faker.datatype.uuid(),
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }

  return <ApplicationCard application={application} />
}
