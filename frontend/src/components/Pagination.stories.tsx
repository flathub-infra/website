import React from "react"
import { Meta } from "@storybook/react"
import Pagination from "./Pagination"

export default {
  title: "Components/Pagination",
  component: Pagination,
} as Meta<typeof Pagination>

export const all = () => {
  return (
    <>
      {/* this one should be hidden and not show up */}
      <Pagination currentPage={1} pages={[1]} />
      <Pagination currentPage={3} pages={[1, 2, 3, 4, 5]} />
      <Pagination
        currentPage={12}
        pages={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
      />
      <Pagination
        currentPage={3}
        pages={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
      />
    </>
  )
}
