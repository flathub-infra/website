import React from "react"
import { Meta } from "@storybook/nextjs"
import { faker } from "@faker-js/faker"
import AppDevelopersControls from "./AppDevelopersControls"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DevelopersResponse } from "../../codegen/model"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

const app = {
  id: faker.string.uuid(),
  icon: faker.image.url(),
  name: faker.commerce.product(),
  developer_name: faker.internet.username(),
}

export default {
  title: "Components/Application/AppDevelopersControls",
  component: AppDevelopersControls,
} as Meta<typeof AppDevelopersControls>

function fakeDeveloper(isSelf: boolean = false, isPrimary: boolean = false) {
  return {
    id: faker.number.int(),
    is_self: isSelf,
    name: faker.person.fullName(),
    is_primary: isPrimary,
  }
}

export const PrimaryDeveloperOnly = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [fakeDeveloper(true, true)],
          invites: [],
        } as DevelopersResponse,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  render: () => <AppDevelopersControls app={app} />,
}

export const WithInvites = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [fakeDeveloper(true, true)],
          invites: [
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
          ],
        } as DevelopersResponse,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  render: () => <AppDevelopersControls app={app} />,
}

export const WithOtherDevs = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [
            fakeDeveloper(true, true),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
            fakeDeveloper(),
          ],
          invites: [],
        } as DevelopersResponse,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  render: () => <AppDevelopersControls app={app} />,
}

export const NotPrimaryDev = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [
            {
              id: faker.number.int(),
              is_self: true,
              name: faker.person.fullName(),
              is_primary: false,
            },
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: true,
            },
            fakeDeveloper(),
          ],
          invites: [],
        } as DevelopersResponse,
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
  render: () => <AppDevelopersControls app={app} />,
}
