import { faker } from "@faker-js/faker"
import { ComponentMeta } from "@storybook/react"
import React from "react"
import LoginVerification from "./LoginVerification"
import { AvailableMethod } from "../../../codegen/model"

export default {
  title: "Components/Application/AppVerificationControls/LoginVerification",
  component: LoginVerification,
} as ComponentMeta<typeof LoginVerification>

export const Individual = () => {
  const method: AvailableMethod = {
    method: "login_provider",
    login_provider: "github",
    login_name: faker.internet.userName(),
    login_is_organization: false,
    login_status: "ready",
  }

  return (
    <div className="space-y-3">
      <LoginVerification
        appId="io.github.appId"
        isNewApp={false}
        method={method}
        onVerified={() => {}}
        onReloadNeeded={() => {}}
      ></LoginVerification>
    </div>
  )
}

export const Organization = () => {
  const method: AvailableMethod = {
    method: "login_provider",
    login_provider: "github",
    login_name: faker.internet.domainWord(),
    login_is_organization: true,
    login_status: "ready",
  }

  return (
    <div className="space-y-3">
      <LoginVerification
        appId="io.github.appId"
        method={method}
        isNewApp={false}
        onVerified={() => {}}
        onReloadNeeded={() => {}}
      ></LoginVerification>
    </div>
  )
}
