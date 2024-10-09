import React from "react"
import { Meta } from "@storybook/react"
import { faker } from "@faker-js/faker"
import { AppHeader } from "./AppHeader"
import { Appstream } from "../../../src/types/Appstream"
import { VendingSetup } from "../../codegen/model"

export default {
  title: "Components/Application/AppHeader",
  component: AppHeader,
} as Meta<typeof AppHeader>

export const Install = () => {
  const app = {
    id: faker.string.uuid(),
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
  }

  return (
    <AppHeader
      app={app}
      vendingSetup={undefined}
      verificationStatus={{ verified: true, method: "manual" }}
      isQualityModalOpen={false}
    />
  )
}

export const InstallNotVerified = () => {
  const app = {
    id: faker.string.uuid(),
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
  }

  return (
    <AppHeader
      app={app}
      vendingSetup={undefined}
      verificationStatus={{ verified: false }}
      isQualityModalOpen={false}
    />
  )
}

export const InstallWithDonate = () => {
  const app: Appstream = {
    id: faker.string.uuid(),
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
    urls: { donation: faker.internet.url() },
  }

  return (
    <AppHeader
      app={app}
      vendingSetup={undefined}
      verificationStatus={{ verified: true }}
      isQualityModalOpen={false}
    />
  )
}

export const WithVending = () => {
  const appId = faker.string.uuid()
  const app: Appstream = {
    id: appId,
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    name: faker.commerce.product(),
    developer_name: faker.internet.userName(),
    urls: { donation: faker.internet.url() },
  }

  const vending: Pick<VendingSetup, "recommended_donation"> = {
    recommended_donation: faker.number.int({ min: 1, max: 150 }),
  }

  return (
    <AppHeader
      app={app}
      vendingSetup={vending}
      verificationStatus={{ verified: true }}
      isQualityModalOpen={false}
    />
  )
}
