import React from "react"
import { Meta } from "@storybook/react"
import CodeCopy from "./CodeCopy"

export default {
  title: "Components/Application/CodeCopy",
  component: CodeCopy,
} as Meta<typeof CodeCopy>

export const Generated = () => {
  return <CodeCopy text={"This is the code, that will be copied"} />
}
