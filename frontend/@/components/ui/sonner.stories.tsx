import type { Meta, StoryObj } from "@storybook/react"

import { Toaster } from "./sonner"
import { toast } from "sonner"
import React from "react"
import { i18n } from "next-i18next"

const meta = {
  component: Toaster,
} satisfies Meta<typeof Toaster>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div>
      <button onClick={() => toast("Hello world!")}>Click me</button>
      <Toaster
        position={i18n?.dir() === "rtl" ? "bottom-left" : "bottom-right"}
        dir={i18n?.dir()}
      />
    </div>
  ),
}

export const Error: Story = {
  render: () => (
    <div>
      <button onClick={() => toast.error("Hello world!")}>Click me</button>
      <Toaster
        position={i18n?.dir() === "rtl" ? "bottom-left" : "bottom-right"}
        dir={i18n?.dir()}
      />
    </div>
  ),
}

export const Success: Story = {
  render: () => (
    <div>
      <button onClick={() => toast.success("Hello world!")}>Click me</button>
      <Toaster
        position={i18n?.dir() === "rtl" ? "bottom-left" : "bottom-right"}
        dir={i18n?.dir()}
      />
    </div>
  ),
}

export const Info: Story = {
  render: () => (
    <div>
      <button onClick={() => toast.info("Hello world!")}>Click me</button>
      <Toaster
        position={i18n?.dir() === "rtl" ? "bottom-left" : "bottom-right"}
        dir={i18n?.dir()}
      />
    </div>
  ),
}