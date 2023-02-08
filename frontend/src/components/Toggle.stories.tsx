import React from "react"
import { Meta } from "@storybook/react"
import Toggle from "./Toggle"

export default {
  title: "Components/Toggle",
  component: Toggle,
} as Meta<typeof Toggle>

export const Generated = () => {
  const [enabled, setEnabled] = React.useState(false)

  return <Toggle enabled={enabled} setEnabled={setEnabled} />
}
