import { Meta } from "@storybook/nextjs-vite"
import Details from "./Details"
import { faker } from "@faker-js/faker"
import { GetAppstreamAppstreamAppIdGet200, StatsResultApp } from "../../codegen"
import { Summary } from "../../types/Summary"

export default {
  title: "Components/Application/Details",
  component: Details,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof Details>

export const Generated = () => {
  const developerApps = [...Array(faker.number.int({ min: 1, max: 12 }))].map(
    (item, index) => ({
      id: index,
      icon: faker.image.url(),
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  const stats: StatsResultApp = {
    id: faker.string.uuid(),
    installs_last_7_days: faker.number.int({ min: 0, max: 100 }),
    installs_last_month: faker.number.int({ min: 0, max: 100 }),
    installs_per_day: {
      [faker.date.recent().toISOString()]: faker.number.int({
        min: 0,
        max: 100,
      }),
    },
    installs_total: faker.number.int({ min: 0, max: 100 }),
    installs_per_country: {
      [faker.location.countryCode()]: faker.number.int({
        min: 0,
        max: 100,
      }),
    },
  }

  const app: GetAppstreamAppstreamAppIdGet200 = {
    id: faker.number.int().toString(),
    name: faker.commerce.productName(),
    summary: faker.commerce.productDescription(),
    releases: [
      {
        timestamp: faker.date.recent().getTime() / 1000,
        version: faker.number.int().toString(),
      },
    ],
  }

  const summary: Summary = {
    timestamp: faker.date.recent().getTime() / 1000,
    download_size: faker.number.int({ min: 0, max: 100 }),
    installed_size: faker.number.int({ min: 0, max: 100 }),
  }

  return (
    <Details
      app={app}
      summary={summary}
      stats={stats}
      developerApps={developerApps}
      verificationStatus={{ verified: true }}
      keywords={["linux", "flatpak"]}
    />
  )
}
