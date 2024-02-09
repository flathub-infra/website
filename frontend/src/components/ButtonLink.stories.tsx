import React from "react"
import { Meta } from "@storybook/react"
import ButtonLink from "./ButtonLink"
import { HiMiniPlus } from "react-icons/hi2"

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
      <ButtonLink passHref href={"/"}>
        <HiMiniPlus className="w-5 h-5" />
        New app
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
      <ButtonLink passHref href={"/"} variant="secondary">
        <HiMiniPlus className="w-5 h-5" />
        New app
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
      <ButtonLink passHref href={"/"} variant="destructive">
        <HiMiniPlus className="w-5 h-5" />
        New app
      </ButtonLink>
      <ButtonLink disabled passHref href={"/"} variant="destructive">
        Disabled
      </ButtonLink>
    </div>
  )
}
