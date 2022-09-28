import React from "react"
import { ComponentMeta } from "@storybook/react"
import ButtonLink from "./ButtonLink"

export default {
  title: "Components/ButtonLink",
  component: ButtonLink,
} as ComponentMeta<typeof ButtonLink>

export const Primary = () => {
  return (
    <ButtonLink passHref href={"/"}>
      Test
    </ButtonLink>
  )
}

export const Secondary = () => {
  return (
    <ButtonLink passHref href={"/"} variant="secondary">
      Test
    </ButtonLink>
  )
}

export const Destructive = () => {
  return (
    <ButtonLink passHref href={"/"} variant="destructive">
      Test
    </ButtonLink>
  )
}

export const Disabled = () => {
  return (
    <ButtonLink passHref href={"/"} disabled variant="primary">
      Test
    </ButtonLink>
  )
}
