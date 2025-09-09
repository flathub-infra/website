import { Meta } from "@storybook/nextjs-vite"
import Breadcrumbs from "./Breadcrumbs"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as Meta<typeof Breadcrumbs>

export const Generated = () => {
  const pages = [
    { name: "User Wallet", href: "/wallet", current: false },
    {
      name: "Transaction Summary",
      href: "/payment/details/12",
      current: true,
    },
  ]

  return <Breadcrumbs pages={pages} />
}
