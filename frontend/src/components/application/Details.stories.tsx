import React from "react"
import { Meta } from "@storybook/react"
import Details from "./Details"
import { faker } from "@faker-js/faker"
import { AppStats } from "../../types/AppStats"
import { Appstream } from "../../types/Appstream"
import { Summary } from "../../types/Summary"

export default {
  title: "Components/Application/Details",
  component: Details,
} as Meta<typeof Details>

export const Generated = () => {
  const developerApps = [
    ...Array(faker.datatype.number({ min: 1, max: 12 })),
  ].map((item, index) => ({
    id: index,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }))
  const projectgroupApps = [
    ...Array(faker.datatype.number({ min: 1, max: 12 })),
  ].map((item, index) => ({
    id: index,
    icon: faker.image.image(),
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
  }))

  const stats: AppStats = {
    installs_last_7_days: faker.datatype.number({ min: 0, max: 100 }),
    installs_last_month: faker.datatype.number({ min: 0, max: 100 }),
    installs_per_day: {
      [faker.date.recent().toISOString()]: faker.datatype.number({
        min: 0,
        max: 100,
      }),
    },
    installs_total: faker.datatype.number({ min: 0, max: 100 }),
  }

  const app: Appstream = {
    id: faker.datatype.number().toString(),
    releases: [
      {
        version: faker.datatype.number().toString(),
      },
    ],
  }

  const summary: Summary = {
    download_size: faker.datatype.number({ min: 0, max: 100 }),
    installed_size: faker.datatype.number({ min: 0, max: 100 }),
  }

  return (
    <Details
      app={app}
      summary={summary}
      stats={stats}
      developerApps={developerApps}
      projectgroupApps={projectgroupApps}
      verificationStatus={{ verified: true }}
    />
  )
}
