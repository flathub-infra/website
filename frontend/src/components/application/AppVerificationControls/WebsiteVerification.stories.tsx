import React from "react"
import { ComponentMeta } from "@storybook/react"
import { faker } from "@faker-js/faker"
import WebsiteVerification from "./WebsiteVerification"
import { VerificationMethodWebsite } from "../../../types/VerificationAvailableMethods"

export default {
  title: "Components/Application/AppVerificationControls/WebsiteVerification",
  component: WebsiteVerification,
} as ComponentMeta<typeof WebsiteVerification>

export const NoTokenFirstStep = () => {
  const method: VerificationMethodWebsite = {
    method: "website",
    website: faker.internet.url(),
  }

  return (
    <div className="space-y-3">
      <WebsiteVerification
        appId="my.domain.appId"
        method={method}
        onVerified={() => {}}
      />
    </div>
  )
}

export const HasTokenSecondStep = () => {
  const method: VerificationMethodWebsite = {
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
      />
    </div>
  )
}
