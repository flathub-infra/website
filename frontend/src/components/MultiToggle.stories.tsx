import { Meta } from "@storybook/nextjs-vite"
import React from "react"
import MultiToggle from "./MultiToggle"
import { HiCheck, HiQuestionMarkCircle, HiXMark } from "react-icons/hi2"

export default {
  title: "Components/MultiToggle",
  component: MultiToggle,
} as Meta<typeof MultiToggle>

export const smallPrimary = () => {
  const toggle: boolean = false

  return (
    <div className="w-fit">
      <MultiToggle
        size="sm"
        items={[
          {
            id: "not-set",
            content: <HiQuestionMarkCircle className="w-6 h-6" />,
            selected: toggle === undefined,
            onClick: () => {},
            disabled: true,
            color: "bg-flathub-gainsborow dark:bg-flathub-gainsborow",
          },
          {
            id: "not_passed",
            content: <HiXMark className="w-6 h-6" />,
            onClick: () => {},
            selected: toggle === false,
            color: "bg-flathub-electric-red dark:bg-flathub-electric-red",
          },
          {
            id: "passed",
            content: <HiCheck className="w-6 h-6" />,
            onClick: () => {},
            selected: toggle === true,
          },
        ]}
      />
    </div>
  )
}

export const largePrimary = () => {
  return (
    <MultiToggle
      items={[{ name: "One" }, { name: "Two" }, { name: "Three" }].map(
        (x, i) => ({
          id: x.name,
          content: <div className="font-semibold truncate">{x.name}</div>,
          selected: i === 0,
          onClick: () => console.log(x.name),
        }),
      )}
      size={"lg"}
      variant="primary"
    />
  )
}

export const largeSecondary = () => {
  return (
    <MultiToggle
      items={[{ name: "One" }, { name: "Two" }, { name: "Three" }].map(
        (x, i) => ({
          id: x.name,
          content: <div className="font-semibold truncate">{x.name}</div>,
          selected: i === 0,
          onClick: () => console.log(x.name),
        }),
      )}
      size={"lg"}
      variant="secondary"
    />
  )
}
