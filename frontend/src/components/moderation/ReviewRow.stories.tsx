import React from "react"
import { Meta } from "@storybook/react"
import ReviewRow from "./ReviewRow"
import { t } from "i18next"
import { ModerationAppdataRequest } from "../../types/Moderation"
import { faker } from "@faker-js/faker"

export default {
  title: "Components/ReviewRow",
  component: ReviewRow,
} as Meta<typeof ReviewRow>

export const Primary = () => {
  const request: ModerationAppdataRequest = {
    request_type: "appdata",
    request_data: {
      keys: {
        Name: "Test App",
      },
      current_values: {
        Name: "Test App",
      },
    },
    id: 1,
    appid: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: true,

    handled_by: "Kolja",
    handled_at: faker.date.past().toISOString(),
    is_approved: false,
    comment: undefined,
  }

  return (
    <ReviewRow title={t("moderation-appstream")} request={request}>
      <div>Show table here</div>
    </ReviewRow>
  )
}
