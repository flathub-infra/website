import React from "react"
import { Meta } from "@storybook/nextjs"
import { AppDevModeration } from "./AppDevModeration"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/AppDevModeration",
  component: AppDevModeration,
  decorators: [
    (Story) => {
      queryClient.setQueryData(["moderation", "tv.abc.TestApp", 10, 0], {
        data: {
          requests: [
            {
              id: 1332,
              app_id: "org.kde.kstars",
              created_at: "2024-09-17T06:47:06.087839",
              build_id: 130350,
              job_id: 234976,
              is_outdated: false,
              request_type: "appdata",
              request_data: {
                keys: { developer_name: "KDE" },
                current_values: {
                  name: "KStars",
                  summary: "Desktop Planetarium",
                  developer_name: null,
                  project_license: "GPL-2.0+",
                },
              },
              is_new_submission: false,
              handled_by: "Bartłomiej Piotrowski",
              handled_at: "2024-09-17T08:02:23.399999",
              is_approved: true,
            },
          ],
          requests_count: 1,
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
