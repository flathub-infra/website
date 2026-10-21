import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { http, HttpResponse } from "msw"
import { expect, fn, userEvent, within } from "storybook/test"
import {
  useRouter,
  useSearchParams,
  usePathname,
} from "@storybook/nextjs-vite/navigation.mock"
import { ReadonlyURLSearchParams } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import en from "../../../public/locales/en/common.json"
import de from "../../../public/locales/de/common.json"
import { UserContext, UserDispatchContext } from "src/context/user-info"
import LoginClient from "./login-client"

const meta = {
  title: "Login/Email",
  component: LoginClient,
  args: { providers: [], locale: "en", emailForm: true, embedded: true },
  beforeEach: () => {
    useRouter.mockReturnValue({
      back: fn(),
      forward: fn(),
      refresh: fn(),
      push: fn(),
      replace: fn(),
      prefetch: fn(),
    })
    useSearchParams.mockReturnValue(
      new ReadonlyURLSearchParams("returnTo=%2Ffavorites"),
    )
    usePathname.mockReturnValue("/en/login")
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/en/login", query: { returnTo: "/favorites" } },
    },
    msw: {
      handlers: [
        http.post(
          "*/auth/email/request",
          () => new HttpResponse(null, { status: 202 }),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <UserContext value={{ loading: false }}>
        <UserDispatchContext value={() => {}}>
          <main className="mx-auto w-full max-w-md px-5 py-16">
            <Story />
          </main>
        </UserDispatchContext>
      </UserContext>
    ),
  ],
} satisfies Meta<typeof LoginClient>

export default meta
type Story = StoryObj<typeof meta>

export const BeforeSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("link", { name: "Developer sign in" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByLabelText("Email address")).toHaveValue("")
  },
}

export const LinkRequested: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByLabelText("Email address"),
      "reader@example.com",
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Email me a sign-in link" }),
    )
    const confirmation = await canvas.findByText(/If the address is valid/)
    await expect(confirmation.closest('[role="status"]')).toContainElement(
      canvas.getByRole("link", { name: "Developer sign in" }),
    )
    await expect(
      canvas.getByRole("link", { name: "Developer sign in" }),
    ).toHaveAttribute("href", "/en/login/developer?returnTo=%2Ffavorites")
    await expect(
      canvas.getByRole("button", { name: /Resend available in/ }),
    ).toBeDisabled()
  },
}

export const Standalone: Story = { args: { embedded: false } }

export const German: Story = {
  args: { locale: "de" },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="de" messages={{ ...en, ...de }}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByLabelText(de["email-login-email-address"]),
      "reader@example.com",
    )
    await userEvent.click(
      canvas.getByRole("button", { name: de["email-login-send-link"] }),
    )
    await expect(
      await canvas.findByRole("link", {
        name: "Entwickler-Anmeldung",
      }),
    ).toHaveAttribute("href", "/de/login/developer?returnTo=%2Ffavorites")
  },
}
