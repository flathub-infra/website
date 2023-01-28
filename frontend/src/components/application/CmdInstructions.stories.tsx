import React from "react"
import { Meta } from "@storybook/react"
import CmdInstructions from "./CmdInstructions"

export default {
  title: "Components/Application/CmdInstructions",
  component: CmdInstructions,
} as Meta<typeof CmdInstructions>

export const Generated = () => {
  return <CmdInstructions appId={"my.domain.appId"} />
}
