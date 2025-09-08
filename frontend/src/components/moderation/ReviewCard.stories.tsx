import { Meta } from "@storybook/nextjs-vite"
import ReviewCard from "./ReviewCard"
import { faker } from "@faker-js/faker"
import { ModerationRequestResponse, Permission } from "../../codegen/model"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UserContext } from "../../context/user-info"
import { UserState } from "../../types/Login"
import { useTranslations } from "next-intl"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

const request_id = 1

export default {
  title: "Components/Moderation/ReviewCard",
  component: ReviewCard,
  decorators: [
    (Story) => {
      queryClient.setQueryData(["review", request_id], {
        data: { github_issue_url: "https://www.flathub.org" },
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof ReviewCard>

export const PrimaryRejected = () => {
  const t = useTranslations()
  const request: ModerationRequestResponse = {
    request_type: "appdata",
    request_data: {
      keys: {
        Name: "Test App",
      },
      current_values: {
        Name: "Test App",
      },
    },
    id: request_id,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: true,

    handled_by: "Kolja",
    handled_at: faker.date.past().toISOString(),
    is_approved: false,
    comment: null,
  }

  const userInfo: UserState = {
    loading: false,
    info: {
      permissions: [Permission.moderation],
    },
  }

  return (
    <UserContext.Provider value={{ ...userInfo }}>
      <ReviewCard title={t("moderation-appstream")} request={request}>
        <div>Show table here</div>
      </ReviewCard>
    </UserContext.Provider>
  )
}

export const Primary = () => {
  const t = useTranslations()
  const request: ModerationRequestResponse = {
    request_type: "appdata",
    request_data: {
      keys: {
        Name: "Test App",
      },
      current_values: {
        Name: "Test App",
      },
    },
    id: request_id,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: true,

    handled_by: null,
    handled_at: null,
    is_approved: false,
    comment: null,
  }

  const userInfo: UserState = {
    loading: false,
    info: {
      permissions: [Permission.moderation],
    },
  }

  return (
    <UserContext.Provider value={{ ...userInfo }}>
      <ReviewCard title={t("moderation-appstream")} request={request}>
        <div>Show table here</div>
      </ReviewCard>
    </UserContext.Provider>
  )
}
