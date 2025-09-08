import { Meta } from "@storybook/nextjs-vite"
import Breadcrumbs from "./Breadcrumbs"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as Meta<typeof Breadcrumbs>

export const Generated = () => {
  const pages = [
    { name: "user-wallet", href: "/wallet", current: false },
    {
      name: "transaction-summary",
      href: "/payment/details/12",
      current: true,
    },
  ]

  return <Breadcrumbs pages={pages} />
}
