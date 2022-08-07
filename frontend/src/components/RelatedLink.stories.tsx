import React from "react"
import { ComponentMeta } from "@storybook/react"
import RelatedLink from "./RelatedLink"

export default {
  title: "Components/RelatedLink",
  component: RelatedLink,
} as ComponentMeta<typeof RelatedLink>

export const Generated = () => {
  return <RelatedLink href={"test"} pageTitle={"Title"} />
}
