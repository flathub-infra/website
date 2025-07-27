import React from "react"
import { Meta } from "@storybook/nextjs-vite"
import CodeCopy from "./CodeCopy"

export default {
  title: "Components/Application/CodeCopy",
  component: CodeCopy,
} as Meta<typeof CodeCopy>

export const Generated = () => {
  return <CodeCopy text={"This is the code, that will be copied"} />
}

export const GeneratedNested = () => {
  return <CodeCopy text={"This is the code, that will be copied"} nested />
}

export const GeneratedWithOnCopy = () => {
  return (
    <CodeCopy
      text={"This is the code, that will be copied"}
      onCopy={() => alert("Copied")}
    />
  )
}

export const GeneratedWithMultipleLines = () => {
  return (
    <CodeCopy
      text={`This is the code,
  that will be copied
  with multiple lines`}
    />
  )
}
export const GeneratedWithMultipleLines2 = () => {
  return (
    <CodeCopy
      text={`This is the code,\n that will be copied\n  with multiple lines`}
    />
  )
}
