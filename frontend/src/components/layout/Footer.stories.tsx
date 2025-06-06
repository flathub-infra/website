import React from "react"
import { Meta } from "@storybook/nextjs"
import Footer from "./Footer"

export default {
  title: "Components/Layout/Footer",
  component: Footer,
} as Meta<typeof Footer>

export const Generated = () => {
  return <Footer />
}
