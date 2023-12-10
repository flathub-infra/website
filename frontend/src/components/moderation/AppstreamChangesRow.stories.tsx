import React from "react"
import { Meta } from "@storybook/react"
import AppstreamChangesRow from "./AppstreamChangesRow"
import { faker } from "@faker-js/faker"
import { ModerationRequestResponse } from "../../codegen/model"

export default {
  title: "Components/Moderation/AppstreamChangesRow",
  component: AppstreamChangesRow,
} as Meta<typeof AppstreamChangesRow>

export const Primary = () => {
  const request: ModerationRequestResponse = {
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
  }

  return <AppstreamChangesRow request={request} />
}
