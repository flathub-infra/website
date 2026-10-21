import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import InstallFallback from "./InstallFallback"
import { NextIntlClientProvider } from "next-intl"
import deepmerge from "deepmerge"
import en from "../../../public/locales/en/common.json"
import de from "../../../public/locales/de/common.json"
import ar from "../../../public/locales/ar/common.json"
import { expect, userEvent, within } from "storybook/test"

const meta = {
  component: InstallFallback,
} satisfies Meta<typeof InstallFallback>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "org.gimp.GIMP",
      name: "GNU Image Manipulation Program",
      icon: "https://dl.flathub.org/media/org/gimp/GIMP/95e6d7d59d33a0f9364535dbe023d807/icons/128x128/org.gimp.GIMP.png",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("link", { name: "Download .flatpakref" }),
    ).toHaveAttribute(
      "href",
      "https://dl.flathub.org/repo/appstream/org.gimp.GIMP.flatpakref",
    )
    await expect(
      canvas.getByRole("link", { name: "Open in software manager" }),
    ).toHaveAttribute(
      "href",
      "flatpak+https://dl.flathub.org/repo/appstream/org.gimp.GIMP.flatpakref",
    )
    await expect(
      canvas.getByRole("link", {
        name: "setup guide for your Linux distribution",
      }),
    ).toHaveAttribute("href", "/setup")
    const terminal = canvasElement.querySelector("summary")!
    await expect(
      canvas.getByText("flatpak install flathub org.gimp.GIMP"),
    ).not.toBeVisible()
    terminal.focus()
    await userEvent.keyboard("{Enter}")
    await expect(
      canvas.getByText("flatpak install flathub org.gimp.GIMP"),
    ).toBeVisible()
    await userEvent.tab()
    await expect(
      canvas.getByRole("button", { name: "Copy Text" }),
    ).toHaveFocus()
    terminal.focus()
    await userEvent.keyboard(" ")
    await expect(
      canvas.getByText("flatpak install flathub org.gimp.GIMP"),
    ).not.toBeVisible()
  },
}

export const LongNameMobile: Story = {
  args: {
    app: {
      id: "org.libreoffice.LibreOffice",
      name: "LibreOffice — Writer, Calc, Impress, Draw, Math and Base",
      icon: "",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390 }}>
        <Story />
      </div>
    ),
  ],
}

// Match production's English fallback for strings awaiting translation.
export const German: Story = {
  ...LongNameMobile,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="de" messages={deepmerge(en, de)}>
        <div style={{ maxWidth: 390 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
}

export const Arabic: Story = {
  ...LongNameMobile,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="ar" messages={deepmerge(en, ar)}>
        <div dir="rtl" style={{ maxWidth: 390 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
}
