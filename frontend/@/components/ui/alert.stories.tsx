import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Alert, AlertDescription, AlertTitle } from "./alert"
import { HiMiniExclamationTriangle } from "react-icons/hi2"
import React from "react"

const meta = {
  component: Alert,
  title: "Components/UI/Alert",
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: <AlertDescription>This is an alert</AlertDescription>,
  },
}

export const DefaultDestructive: Story = {
  args: {
    variant: "destructive",
    children: <AlertDescription>This is an alert</AlertDescription>,
  },
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <HiMiniExclamationTriangle />
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>This is an alert</AlertDescription>
      </>
    ),
  },
}

export const WithIconDestructive: Story = {
  args: {
    variant: "destructive",
    children: (
      <>
        <HiMiniExclamationTriangle />
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>This is an alert</AlertDescription>
      </>
    ),
  },
}
