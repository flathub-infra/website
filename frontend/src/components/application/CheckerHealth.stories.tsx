import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { delay, http, HttpResponse } from "msw"
import { useState, type ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import messages from "../../../public/locales/en/common.json"
import type { CheckerHealth as Health } from "src/codegen/model"
import CheckerHealth from "./CheckerHealth"
import { checkerSource } from "./CheckerHealth.fixtures"
import AppMaintenance from "./AppMaintenance"
import { UserContext } from "src/context/user-info"
import { Permission } from "src/codegen/model"

function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const evidence: Health = {
  last_report_at: "2026-11-08T17:45:00Z",
  last_check_at: "2026-11-08T17:45:00Z",
  sources: [
    {
      branch: "branch/24.08",
      source: checkerSource({
        manifest: "modules/jansson.json",
        source_pointer: "/modules/0/sources/0",
        module: "jansson",
        checker_type: "json",
        status: "failed",
        errors: [
          {
            type: "HTTPError",
            message:
              "503 Service Unavailable: https://example.org/releases/latest",
          },
        ],
      }),
      observed_at: "2026-11-08T17:45:00Z",
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
      failures: 3,
    },
    {
      branch: "branch/25.08",
      source: checkerSource({
        manifest: "app.yml",
        source_pointer: "/modules/0/sources/0",
        module: "Cardinal",
        status: "checked",
      }),
      observed_at: "2026-11-08T17:45:00Z",
      recovered_at: "2026-11-08T17:45:00Z",
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
      failures: 0,
    },
    {
      branch: null,
      source: checkerSource({
        manifest: "app.yml",
        source_pointer: "/modules/1/sources/0",
        module: "libarchive",
        status: "blocked",
        reason: "update_policy",
      }),
      observed_at: "2026-11-08T17:45:00Z",
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
      failures: 0,
    },
  ],
  diagnostics: [
    {
      branch: null,
      error: {
        type: "ManifestFileOpenError",
        message: "Cannot open shared-modules/SDL/SDL_image-1.2.12.json",
      },
      observations: 2,
      first_seen_at: "2026-11-07T17:45:00Z",
      last_seen_at: "2026-11-08T17:45:00Z",
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
    },
  ],
  history: [
    {
      observed_at: "2026-11-08T17:45:00Z",
      status: "completed",
      delivery: "pr_handled",
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
      branches: [
        { branch: "branch/25.08", status: "completed", delivery: "pr_handled" },
      ],
    },
  ],
}

const meta = {
  title: "Components/Application/CheckerHealth",
  component: CheckerHealth,
  args: { appId: "org.example.App" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <QueryProvider>
        <div className="mx-auto max-w-4xl [--muted-foreground:var(--flathub-granite-gray)] [--primary:var(--flathub-celestial-blue-dark)] dark:[--muted-foreground:var(--flathub-gray-x11)] dark:[--primary:var(--flathub-celestial-blue-light)] dark:[--primary-foreground:var(--flathub-dark-gunmetal)] [&_p]:mb-0">
          <NextIntlClientProvider
            locale="en"
            messages={messages}
            timeZone="UTC"
          >
            <Story />
          </NextIntlClientProvider>
        </div>
      </QueryProvider>
    ),
  ],
} satisfies Meta<typeof CheckerHealth>
export default meta
type Story = StoryObj<typeof meta>

export const Observations: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json(evidence),
        ),
      ],
    },
  },
}

export const UnknownLocationsAndSkippedRuntime: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            sources: [
              ...[0, 1].map(() => ({
                ...evidence.sources![0],
                source: checkerSource({
                  module: "jansson",
                  source_pointer: null,
                  status: "failed",
                  errors: [
                    { type: "HTTPError", message: "503 Service Unavailable" },
                  ],
                }),
                failures: 1,
              })),
              {
                ...evidence.sources![1],
                source: checkerSource({
                  module: "Root source",
                  source_pointer: "",
                }),
              },
            ],
            history: [
              {
                ...evidence.history![0],
                branches: [
                  {
                    branch: "branch/24.08",
                    status: "skipped",
                    skip_reason: "runtime-end-of-life",
                    runtime_eol: [
                      {
                        ref: "runtime/org.freedesktop.Platform/x86_64/24.08",
                        end_of_life: "This runtime is no longer supported.",
                        end_of_life_rebase:
                          "runtime/org.freedesktop.Platform/x86_64/25.08",
                      },
                    ],
                  },
                ],
              },
            ],
          } satisfies Health),
        ),
      ],
    },
  },
}
export const Unknown: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({}),
        ),
      ],
    },
  },
}
export const Unavailable: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(
          "*/apps/org.example.App/checker-health",
          () => new HttpResponse(null, { status: 503 }),
        ),
      ],
    },
  },
}

export const ManySources: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            sources: [
              ...(evidence.sources ?? []),
              ...Array.from({ length: 150 }, (_, index) => ({
                branch: null,
                source: checkerSource({
                  manifest: "generated-sources.json",
                  source_pointer: `/${index}`,
                  module: `dependency-${index}`,
                  status: "unchecked",
                  reason: "no_update_checker",
                  checkers_run: [],
                }),
                observed_at: "2026-11-07T17:45:00Z",
                run_url: "https://github.com/flathub/flathub/actions/runs/123",
              })),
            ],
          }),
        ),
      ],
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", async () => {
          await delay("infinite")
          return HttpResponse.json({})
        }),
      ],
    },
  },
}

export const ReportErrorsOnly: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({ ...evidence, sources: [], last_check_at: null }),
        ),
      ],
    },
  },
}

export const Recovery: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            sources: [evidence.sources?.[1]],
            diagnostics: [],
          }),
        ),
      ],
    },
  },
}

export const InMaintenancePanel: Story = {
  render: ({ appId }) => (
    <UserContext
      value={{
        loading: false,
        info: { permissions: [Permission["modify-users"]] },
      }}
    >
      <AppMaintenance appId={appId} />
    </UserContext>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json(evidence),
        ),
        http.get("*/summary/org.example.App", () =>
          HttpResponse.json({
            metadata: {
              runtime: "org.freedesktop.Platform/x86_64/25.08",
              runtimeIsEol: false,
            },
          }),
        ),
      ],
    },
  },
}
