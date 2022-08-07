import React from "react"
import { ComponentMeta } from "@storybook/react"
import CmdInstructions from "./CmdInstructions"

export default {
  title: "Components/Application/CmdInstructions",
  component: CmdInstructions,
} as ComponentMeta<typeof CmdInstructions>

export const Generated = () => {
  return <CmdInstructions appId={"my.domain.appId"} />
}
