import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"
import type { HomepageCuratedApp } from "src/types/CuratedAppSelection"
import { ScheduledAppSelectionSection } from "./ScheduledAppSelectionSection"

const meta = {
  component: ScheduledAppSelectionSection,
  title: "Components/Application/ScheduledAppSelectionSection",
  parameters: { layout: "padded" },
} satisfies Meta<typeof ScheduledAppSelectionSection>

export default meta
type Story = StoryObj<typeof meta>

function exampleApp(
  id: string,
  name: string,
  summary: string,
  mediaPath: string,
  width: string,
  height: string,
): HomepageCuratedApp {
  const base = `https://dl.flathub.org/media/io/github/${mediaPath}`
  return {
    id,
    name,
    summary,
    icon: `${base}/icons/128x128/${id}.png`,
    screenshots: [
      {
        caption: name,
        sizes: [
          {
            src: `${base}/screenshots/image-1_orig.png`,
            width,
            height,
            scale: "1x",
          },
        ],
      },
    ],
  }
}

const apps = [
  exampleApp(
    "io.github.nokse22.asciidraw",
    "ASCII Draw",
    "Sketch anything using characters",
    "nokse22.asciidraw/d0afc47f36506834589efe83188b2375",
    "1007",
    "723",
  ),
  exampleApp(
    "io.github.revisto.drum-machine",
    "Drum Machine",
    "Create and play drum beats",
    "revisto.drum-machine/50135d3f431ca121bce9ad53206d313d",
    "922",
    "722",
  ),
  exampleApp(
    "io.github.tfuxu.Halftone",
    "Halftone",
    "Dither your images",
    "tfuxu.Halftone/8d33a21465cd97e3faadbce8421e1930",
    "1397",
    "997",
  ),
]

export const Featured: Story = {
  args: {
    selection: {
      id: 1,
      themeKey: "spring-creativity",
      slot: "after-hero",
      layout: "featured",
      apps,
    },
  },
  play: async ({ canvasElement }) => {
    const screenshots =
      canvasElement.querySelectorAll<HTMLImageElement>('img[alt=""]')
    await expect(screenshots).toHaveLength(3)
    for (const screenshot of screenshots) {
      // Transparent source margins must not reintroduce uneven window placement.
      await expect(screenshot.src).toContain("/t:50:FF00FF/")
      await expect(screenshot.getBoundingClientRect().left).toBeCloseTo(
        screenshot.closest("a").getBoundingClientRect().left,
        0,
      )
    }
  },
}

export const Grid: Story = {
  args: {
    selection: { ...Featured.args.selection, layout: "grid" },
  },
}

export const MissingScreenshots: Story = {
  args: {
    selection: {
      ...Featured.args.selection,
      apps: apps.map((app) => ({ ...app, screenshots: [] })),
    },
  },
}

export const SingleApp: Story = {
  args: {
    selection: { ...Featured.args.selection, apps: apps.slice(0, 1) },
  },
}
