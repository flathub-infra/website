import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { BuildTimeChart } from "./build-time-chart"
import {
  PipelineStatus,
  PipelineTrigger,
  type PipelineSummary,
} from "../../../src/codegen-pipeline"

const meta = {
  title: "Components/Build/BuildTimeChart",
  component: BuildTimeChart,
  parameters: {
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof BuildTimeChart>

export default meta
type Story = StoryObj<typeof meta>

const builds = Array.from({ length: 18 }, (_, index) => {
  const startedAt = new Date(Date.UTC(2024, 0, index + 1, 10))
  const durationMinutes = 8 + Math.round(Math.abs(Math.sin(index / 2)) * 18)
  const finishedAt = new Date(startedAt.getTime() + durationMinutes * 60_000)

  return {
    id: `fixture-${index}`,
    app_id: "org.example.ChartGallery",
    status: index === 12 ? PipelineStatus.published : PipelineStatus.succeeded,
    triggered_by: PipelineTrigger.manual,
    build_id: index + 1,
    created_at: startedAt.toISOString(),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  }
}) satisfies PipelineSummary[]

export const Default: Story = {
  args: { builds, sampleLimit: 30 },
}

const minimallyVariedBuilds = [4, 4, 4, 5, 4, 4].map(
  (durationMinutes, index) => {
    const startedAt = new Date(Date.UTC(2026, 4, index + 1, 10))
    const finishedAt = new Date(
      startedAt.getTime() + durationMinutes * 60_000,
    )

    return {
      id: `minimal-variation-${index}`,
      app_id: "org.example.ChartGallery",
      status: PipelineStatus.succeeded,
      triggered_by: PipelineTrigger.manual,
      build_id: index + 1,
      created_at: startedAt.toISOString(),
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    }
  },
) satisfies PipelineSummary[]

export const MinimalVariation: Story = {
  args: { builds: minimallyVariedBuilds, sampleLimit: 6 },
}
