import React from "react"
import { Meta } from "@storybook/react"
import { AppDevModeration } from "./AppDevModeration"
import { faker } from "@faker-js/faker"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/AppDevModeration",
  component: AppDevModeration,
  decorators: [
    (Story) => {
      queryClient.setQueryData(["moderation", "tv.abc.TestApp", 0], {
        data: {
          requests: [
            {
              request_type: "appdata",
              request_data: {
                keys: {
                  name: "My Awesome Test App",
                },
                current_values: {
                  name: "Test App",
                },
              },
              id: 1,
              app_id: "tv.abc.TestApp",
              created_at: faker.date.past().toISOString(),

              build_id: faker.number.int(),
              job_id: faker.number.int(),
              is_outdated: false,

              is_new_submission: false,

              handled_by: "Kolja",
              handled_at: faker.date.past().toISOString(),
              is_approved: false,
              comment: null,
            },
          ],
        },
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof AppDevModeration>

export const Primary = () => {
  return <AppDevModeration appId="tv.abc.TestApp" />
}
