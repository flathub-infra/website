import React from "react"
import { Meta } from "@storybook/react"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { Appstream } from "../../../src/types/Appstream"
import { VendingSetup } from "../../../src/types/Vending"

export default {
  title: "Components/Application/AppHeader",
  component: AppHeader,
} as Meta<typeof AppHeader>

export const Install = () => {
  const app = {
    id: faker.datatype.uuid(),
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
  }

  return (
    <AppHeader
      app={app}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={undefined}
      verificationStatus={{ verified: true }}
    />
  )
}

export const InstallNotVerified = () => {
  const app = {
    id: faker.datatype.uuid(),
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
  }

  return (
    <AppHeader
      app={app}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={undefined}
      verificationStatus={{ verified: false }}
    />
  )
}

export const InstallWithDonate = () => {
  const app: Appstream = {
    id: faker.datatype.uuid(),
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
    urls: { donation: faker.internet.url() },
  }

  return (
    <AppHeader
      app={app}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={undefined}
      verificationStatus={{ verified: true }}
    />
  )
}

export const WithVending = () => {
  const appId = faker.datatype.uuid()
  const app: Appstream = {
    id: appId,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
    urls: { donation: faker.internet.url() },
  }

  const vending: VendingSetup = {
    recommended_donation: faker.commerce.price(),
  }

  return (
    <AppHeader
      app={app}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={vending}
      verificationStatus={{ verified: true }}
    />
  )
}
