import React from "react"
import { Meta, StoryObj } from "@storybook/nextjs-vite"
import CodeCopy from "./CodeCopy"
import { expect, fn, spyOn, userEvent, within } from "storybook/test"

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

export const KeyboardCopy: StoryObj<typeof CodeCopy> = {
  args: { text: "flatpak install flathub org.gimp.GIMP", onCopy: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const copy = spyOn(document, "execCommand").mockReturnValue(true)
    try {
      canvas.getByRole("button", { name: "Copy Text" }).focus()
      await userEvent.keyboard("{Enter}")
      await expect(canvas.getByRole("status")).toHaveTextContent(
        "Copied to clipboard",
      )
      await expect(args.onCopy).toHaveBeenCalledOnce()
    } finally {
      copy.mockRestore()
    }
  },
}

export const CopyFailure: StoryObj<typeof CodeCopy> = {
  args: {
    text: "flatpak install flathub org.libreoffice.LibreOffice",
    onCopy: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const copy = spyOn(document, "execCommand").mockReturnValue(false)
    const prompt = spyOn(window, "prompt").mockReturnValue(null)
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Copy Text" }))
      await expect(canvas.getByRole("status")).toHaveTextContent(
        "Could not copy automatically",
      )
      await expect(args.onCopy).not.toHaveBeenCalled()
      await expect(canvas.getByText(args.text)).toBeVisible()
      copy.mockReturnValue(true)
      await userEvent.keyboard(" ")
      await expect(canvas.getByRole("status")).toHaveTextContent(
        "Copied to clipboard",
      )
      await expect(args.onCopy).toHaveBeenCalledOnce()
    } finally {
      copy.mockRestore()
      prompt.mockRestore()
    }
  },
}
