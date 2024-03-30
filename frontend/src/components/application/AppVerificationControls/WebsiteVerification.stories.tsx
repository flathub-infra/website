import React from "react"
import { Meta } from "@storybook/react"
import { faker } from "@faker-js/faker"
import WebsiteVerification from "./WebsiteVerification"
import { AvailableMethod } from "../../../codegen/model"

export default {
  title: "Components/Application/AppVerificationControls/WebsiteVerification",
  component: WebsiteVerification,
} as Meta<typeof WebsiteVerification>

export const NoTokenFirstStep = () => {
  const method: AvailableMethod = {
    method: "website",
    website: faker.internet.url(),
  }

  return (
    <div className="space-y-3">
      <WebsiteVerification
        appId="my.domain.appId"
        method={method}
        onVerified={() => {}}
        isNewApp={false}
      />
    </div>
  )
}

export const HasTokenSecondStep = () => {
  const method: AvailableMethod = {
    method: "website",
    website: faker.internet.url(),
    website_token: faker.datatype.uuid(),
  }

  return (
    <div className="space-y-3">
      <WebsiteVerification
        appId="my.domain.appId"
        method={method}
        onVerified={() => {}}
        isNewApp={false}
      />
    </div>
  )
}
