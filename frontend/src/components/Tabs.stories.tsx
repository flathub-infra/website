import React from "react"
import { Meta } from "@storybook/react"
import Tabs, { Tab } from "./Tabs"

export default {
  title: "Components/Tabs",
  component: Tabs,
} as Meta<typeof Tabs>

export const Generated = () => {
  const tabs = [
    { name: "Tab 1", content: <div>Tab 1 content</div> },
    { name: "Tab 2", content: <div>Tab 2 content</div> },
    { name: "Tab 3", content: <div>Tab 3 content</div> },
  ]

  return <Tabs tabs={tabs} tabsIdentifier="tabs" />
}

export const GeneratedWithBadge = () => {
  const tabs: Tab[] = [
    { name: "Tab 1", content: <div>Tab 1 content</div>, badge: "Test" },
    { name: "Tab 2", content: <div>Tab 2 content</div>, badge: "1" },
    { name: "Tab 3", content: <div>Tab 3 content</div> },
  ]

  return <Tabs tabs={tabs} tabsIdentifier="tabs" />
}
