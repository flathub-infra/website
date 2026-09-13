import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"
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

// Include the three-digit last page and both ellipses from issue #7018.
export const ResponsiveWidths: Story = {
  args: {
    currentPage: 5,
    pages: Array.from({ length: 111 }, (_, index) => index + 1),
    pathname: mockPathname,
    searchParams: mockSearchParams,
  },
  render: (args) => (
    <div className="flex flex-wrap items-start gap-8">
      {[320, 375, 390, 1024].map((width) => (
        <section key={width} style={{ width }} className="max-w-full px-4">
          <h2>{width}px viewport with 16px gutters</h2>
          {[1, 4, 5, 56, 108, 111].map((currentPage) => (
            <Pagination key={currentPage} {...args} currentPage={currentPage} />
          ))}
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const nav of canvas.getAllByRole("navigation")) {
      const bounds = nav.getBoundingClientRect()
      const container = nav.parentElement.getBoundingClientRect()
      await expect(bounds.left).toBeGreaterThanOrEqual(container.left + 16)
      await expect(bounds.right).toBeLessThanOrEqual(container.right - 16)
      await expect(
        within(nav).getByRole("link", { name: "1", exact: true }),
      ).toBeVisible()
      await expect(
        within(nav).getByRole("link", { name: "111", exact: true }),
      ).toBeVisible()
      await expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(
        1,
      )
      for (const link of within(nav).getAllByRole("link")) {
        const rect = link.getBoundingClientRect()
        await expect(rect.width).toBe(48)
        await expect(rect.height).toBe(48)
        await expect(rect.left).toBeGreaterThanOrEqual(bounds.left)
        await expect(rect.right).toBeLessThanOrEqual(bounds.right)
        await expect(rect.top).toBeGreaterThanOrEqual(bounds.top)
        await expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom)
      }
    }
  },
}

export const WithCallback: Story = {
  args: {
    ...ResponsiveWidths.args,
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "111" }),
    )
    await expect(args.onClick).toHaveBeenCalledWith(111)
  },
}
