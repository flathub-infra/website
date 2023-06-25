import React from "react"
import { Meta } from "@storybook/react"
import Alert from "./Alert"
import { faker } from "@faker-js/faker"
import { HiExclamationTriangle } from "react-icons/hi2"

export default {
  title: "Components/Alert",
  component: Alert,
} as Meta<typeof Alert>

export const Generated = () => {
  return (
    <Alert
      icon={HiExclamationTriangle}
      headline={faker.lorem.words()}
      message={faker.lorem.sentence()}
      type="warning"
    />
  )
}
