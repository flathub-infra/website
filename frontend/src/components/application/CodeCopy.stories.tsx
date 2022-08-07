import React from "react"
import { ComponentMeta } from "@storybook/react"
import CodeCopy from "./CodeCopy"

export default {
  title: "Components/Application/CodeCopy",
  component: CodeCopy,
} as ComponentMeta<typeof CodeCopy>

export const Generated = () => {
  return <CodeCopy text={"This is the code, that will be copied"} />
}
