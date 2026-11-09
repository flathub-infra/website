import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse, delay } from "msw"
import { useState, type ReactNode } from "react"
import AppMaintenance from "./AppMaintenance"

function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const response = (runtimeIsEol?: boolean) => ({
  arches: ["x86_64"],
  branch: "stable",
  metadata: {
    name: "org.example.App",
    runtime: "org.gnome.Platform/x86_64/48",
    runtimeIsEol,
  },
})

const checkerHandler = http.get("*/apps/org.example.App/checker-health", () =>
  HttpResponse.json({}),
)

const meta = {
  title: "Components/Application/AppMaintenance",
  component: AppMaintenance,
  args: {
    appId: "org.example.App",
    manifestUrl: "https://github.com/flathub/org.example.App",
  },
  parameters: { layout: "padded", nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <QueryProvider>
        <div className="mx-auto max-w-6xl p-6 [--muted-foreground:var(--flathub-granite-gray)] [--primary:var(--flathub-celestial-blue-dark)] dark:[--muted-foreground:var(--flathub-gray-x11)] dark:[--primary:var(--flathub-celestial-blue-light)] dark:[--primary-foreground:var(--flathub-dark-gunmetal)] [&_p]:mb-0">
          <h2 className="mb-6 text-xl font-semibold">Maintenance</h2>
          <Story />
        </div>
      </QueryProvider>
    ),
  ],
} satisfies Meta<typeof AppMaintenance>

export default meta
type Story = StoryObj<typeof meta>

export const EndOfLife: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/summary/org.example.App", () =>
          HttpResponse.json(response(true)),
        ),
        checkerHandler,
      ],
    },
  },
}

export const NoEolFlag: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/summary/org.example.App", () =>
          HttpResponse.json(response(false)),
        ),
        checkerHandler,
      ],
    },
  },
}

export const Unavailable: Story = {
  args: { manifestUrl: null },
  parameters: {
    msw: {
      handlers: [
        http.get(
          "*/summary/org.example.App",
          () => new HttpResponse(null, { status: 503 }),
        ),
        checkerHandler,
      ],
    },
  },
}

export const Loading: Story = {
  args: { manifestUrl: null },
  parameters: {
    msw: {
      handlers: [
        http.get("*/summary/org.example.App", async () => {
          await delay("infinite")
          return HttpResponse.json(response())
        }),
        checkerHandler,
      ],
    },
  },
}

export const MissingManifestMetadata: Story = {
  ...NoEolFlag,
  args: { manifestUrl: null },
}
