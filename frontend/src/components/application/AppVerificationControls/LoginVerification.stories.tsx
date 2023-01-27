import { faker } from "@faker-js/faker"
import { ComponentMeta } from "@storybook/react"
import React from "react"
import { VerificationMethodLoginProvider } from "../../../types/VerificationAvailableMethods"
import LoginVerification from "./LoginVerification"

export default {
  title: "Components/Application/AppVerificationControls/LoginVerification",
  component: LoginVerification,
} as ComponentMeta<typeof LoginVerification>

export const Individual = () => {
  const method: VerificationMethodLoginProvider = {
    method: "login_provider",
    login_provider: "github",
    login_name: faker.internet.userName(),
    login_is_organization: false,
  }

  return (
    <div className="space-y-3">
      <LoginVerification
        appId="io.github.appId"
        method={method}
        onVerified={() => {}}
      ></LoginVerification>
    </div>
  )
}

export const Organization = () => {
  const method: VerificationMethodLoginProvider = {
    method: "login_provider",
    login_provider: "github",
    login_name: faker.internet.domainWord(),
    login_is_organization: true,
  }

  return (
    <div className="space-y-3">
      <LoginVerification
        appId="io.github.appId"
        method={method}
        onVerified={() => {}}
      ></LoginVerification>
    </div>
  )
}
