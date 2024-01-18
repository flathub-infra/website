import React from "react"
import { Meta } from "@storybook/react"
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
  developer_name: faker.internet.userName(),
}

export default {
  title: "Components/Application/AppDevelopersControls",
  component: AppDevelopersControls,
} as Meta<typeof AppDevelopersControls>

export const PrimaryDeveloperOnly = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [
            {
              id: faker.number.int(),
              is_self: true,
              name: "My name",
              is_primary: true,
            },
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

export const WithTwoInvites = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [
            {
              id: faker.number.int(),
              is_self: true,
              name: faker.person.fullName(),
              is_primary: true,
            },
          ],
          invites: [
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: false,
            },
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: false,
            },
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

export const WithTwoOtherDevs = {
  decorators: [
    (Story) => {
      queryClient.setQueryData(["developers", app.id], {
        data: {
          developers: [
            {
              id: faker.number.int(),
              is_self: true,
              name: faker.person.fullName(),
              is_primary: true,
            },
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: false,
            },
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: false,
            },
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
            {
              id: faker.number.int(),
              is_self: false,
              name: faker.person.fullName(),
              is_primary: false,
            },
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
