import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import Pagination from "./Pagination"

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

const mockPathname = "/apps/page/3"
const mockSearchParams = new URLSearchParams("foo=bar")

// This story demonstrates that pagination with only 1 page should be hidden
export const SinglePage: Story = {
  args: {
    currentPage: 1,
    pages: [1],
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
}

// Simple pagination with 5 pages, current page is 3
export const FewPages: Story = {
  args: {
    currentPage: 3,
    pages: [1, 2, 3, 4, 5],
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
}

// Pagination with many pages, current page is at the end
export const ManyPagesAtEnd: Story = {
  args: {
    currentPage: 12,
    pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
}

// Pagination with many pages, current page is near the beginning
export const ManyPagesNearStart: Story = {
  args: {
    currentPage: 3,
    pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
}

// Pagination using query params (for admin pages)
export const WithQueryParams: Story = {
  args: {
    currentPage: 3,
    pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    useQueryParams: true,
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
}
