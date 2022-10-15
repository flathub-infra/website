import React from "react"
import { ComponentMeta } from "@storybook/react"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { Appstream } from "../../../src/types/Appstream"
import { VendingSetup } from "../../../src/types/Vending"

export default {
  title: "Components/Application/AppHeader",
  component: AppHeader,
} as ComponentMeta<typeof AppHeader>

export const Install = () => {
  const app = {
    id: faker.datatype.uuid(),
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
  }

  const user = {
    loading: false,
    info: {
      "dev-flatpaks": [],
    },
  }

  return (
    <AppHeader
      app={app}
      user={user}
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

  const user = {
    loading: false,
    info: {
      "dev-flatpaks": [],
    },
  }

  return (
    <AppHeader
      app={app}
      user={user}
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

  const user = {
    loading: false,
    info: {
      "dev-flatpaks": [],
    },
  }

  return (
    <AppHeader
      app={app}
      user={user}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={undefined}
      verificationStatus={{ verified: true }}
    />
  )
}

export const UserOwnsApp = () => {
  const appId = faker.datatype.uuid()
  const app: Appstream = {
    id: appId,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
    urls: { donation: faker.internet.url() },
  }

  const user = {
    loading: false,
    info: {
      "dev-flatpaks": [appId],
    },
  }

  return (
    <AppHeader
      app={app}
      user={user}
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

  const user = {
    loading: false,
    info: {
      "dev-flatpaks": [appId],
    },
  }

  const vending: VendingSetup = {
    recommended_donation: faker.commerce.price(),
  }

  return (
    <AppHeader
      app={app}
      user={user}
      installClicked={() => {}}
      donateClicked={() => {}}
      vendingSetup={vending}
      verificationStatus={{ verified: true }}
    />
  )
}
