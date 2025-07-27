import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import { CardInfo } from "./CardInfo"
import { faker } from "@faker-js/faker"
import { PaymentCardInfo } from "../../../codegen"

export default {
  title: "Components/Payment/Cards/CardInfo",
  component: CardInfo,
} as Meta<typeof CardInfo>

export const mastercard = () => {
  const card: PaymentCardInfo = {
    brand: "mastercard",
    last4: "4242",
    country: "JP",
    exp_month: 12,
    exp_year: 2021,
    id: faker.string.uuid(),
  }

  return <CardInfo card={card} />
}

export const amex = () => {
  const card: PaymentCardInfo = {
    brand: "amex",
    last4: "4242",
    country: "US",
    exp_month: 12,
    exp_year: 2021,
    id: faker.string.uuid(),
  }

  return <CardInfo card={card} />
}

export const visa = () => {
  const card: PaymentCardInfo = {
    brand: "visa",
    last4: "4242",
    country: "DE",
    exp_month: 12,
    exp_year: 2021,
    id: faker.string.uuid(),
  }

  return <CardInfo card={card} />
}
