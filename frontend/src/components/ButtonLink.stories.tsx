import React from "react"
import { Meta } from "@storybook/react"
import ButtonLink from "./ButtonLink"

export default {
  title: "Components/ButtonLink",
  component: ButtonLink,
} as Meta<typeof ButtonLink>

export const Primary = () => {
  return (
    <div className="flex gap-6">
      <ButtonLink passHref href={"/"}>
        Test
      </ButtonLink>
      <ButtonLink disabled passHref href={"/"}>
        Disabled
      </ButtonLink>
    </div>
  )
}

export const Secondary = () => {
  return (
    <div className="flex gap-6">
      <ButtonLink passHref href={"/"} variant="secondary">
        Test
      </ButtonLink>
      <ButtonLink disabled passHref href={"/"} variant="secondary">
        Disabled
      </ButtonLink>
    </div>
  )
}

export const Destructive = () => {
  return (
    <div className="flex gap-6">
      <ButtonLink passHref href={"/"} variant="destructive">
        Test
      </ButtonLink>
      <ButtonLink disabled passHref href={"/"} variant="destructive">
        Disabled
      </ButtonLink>
    </div>
  )
}
