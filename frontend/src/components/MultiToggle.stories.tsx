import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import MultiToggle from "./MultiToggle"
import {
  CheckIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid"

const meta: Meta<typeof MultiToggle> = {
  title: "Components/MultiToggle",
  component: MultiToggle,
}

export default meta
type Story = StoryObj<typeof meta>

export const SmallWithIcons: Story = {
  args: {
    size: "sm",
    variant: "primary",
  },
  render: function SmallWithIconsRender(args) {
    const [selectedToggle, setSelectedToggle] = useState<boolean | undefined>(
      false,
    )

    return (
      <div className="w-fit overflow-visible">
        <MultiToggle
          {...args}
          items={[
            {
              id: "not-set",
              content: <QuestionMarkCircleIcon className="size-6" />,
              selected: selectedToggle === undefined,
              onClick: () => setSelectedToggle(undefined),
              disabled: true,
              color: "bg-flathub-gainsborow dark:bg-flathub-gainsborow",
            },
            {
              id: "not_passed",
              content: <XMarkIcon className="size-6" />,
              onClick: () => setSelectedToggle(false),
              selected: selectedToggle === false,
              color: "bg-flathub-electric-red dark:bg-flathub-electric-red",
            },
            {
              id: "passed",
              content: <CheckIcon className="size-6" />,
              onClick: () => setSelectedToggle(true),
              selected: selectedToggle === true,
            },
          ]}
        />
      </div>
    )
  },
}

export const LargePrimary: Story = {
  args: {
    size: "lg",
    variant: "primary",
  },
  render: function LargePrimaryRender(args) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const options = [{ name: "One" }, { name: "Two" }, { name: "Three" }]

    return (
      <MultiToggle
        {...args}
        items={options.map((x, i) => ({
          id: x.name,
          content: <div className="font-semibold truncate">{x.name}</div>,
          selected: i === selectedIndex,
          onClick: () => setSelectedIndex(i),
        }))}
      />
    )
  },
}

export const LargeSecondary: Story = {
  args: {
    size: "lg",
    variant: "secondary",
  },
  render: function LargeSecondaryRender(args) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const options = [{ name: "One" }, { name: "Two" }, { name: "Three" }]

    return (
      <MultiToggle
        {...args}
        items={options.map((x, i) => ({
          id: x.name,
          content: <div className="font-semibold truncate">{x.name}</div>,
          selected: i === selectedIndex,
          onClick: () => setSelectedIndex(i),
        }))}
      />
    )
  },
}

export const LargeFlat: Story = {
  args: {
    size: "lg",
    variant: "flat",
  },
  render: function LargeFlatRender(args) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const options = [
      { name: "Newest" },
      { name: "Popular" },
      { name: "Trending" },
    ]

    return (
      <MultiToggle
        {...args}
        items={options.map((x, i) => ({
          id: x.name,
          content: <div className="font-semibold truncate">{x.name}</div>,
          selected: i === selectedIndex,
          onClick: () => setSelectedIndex(i),
        }))}
      />
    )
  },
}
