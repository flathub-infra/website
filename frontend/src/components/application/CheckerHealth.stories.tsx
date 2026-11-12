import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { delay, http, HttpResponse } from "msw"
import { useState, type ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import messages from "../../../public/locales/en/common.json"
import type { CheckerHealth as Health } from "src/codegen/model"
import CheckerHealth from "./CheckerHealth"
import { checkerSource, checkerSubmodule } from "./CheckerHealth.fixtures"
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
      checker: {
        source: "build",
        revision: "bcf09566250d3f994bd3f36d61ba5ef4abdbb91d",
        dirty: null,
      },
      run_url: "https://github.com/flathub/flathub/actions/runs/123",
      branches: [
        {
          branch: "branch/25.08",
          status: "completed",
          delivery: "pr_handled",
          checkout: {
            branch: "branch/25.08",
            commit: "a".repeat(40),
            dirty: false,
          },
          pull_request: {
            url: "https://github.com/flathub/org.example.App/pull/123",
            outcome: "existing_open",
          },
        },
        {
          branch: "branch/24.08",
          status: "skipped",
          skip_reason: "end-of-life",
          checkout: {
            branch: "branch/24.08",
            commit: "b".repeat(40),
            dirty: true,
          },
        },
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

export const SubmoduleUpdates: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            diagnostics: [],
            sources: [evidence.sources![1]],
            history: [
              {
                ...evidence.history![0],
                branches: [
                  {
                    ...evidence.history![0].branches[0],
                    submodules: [checkerSubmodule()],
                  },
                  {
                    branch: "branch/24.08",
                    status: "completed",
                    delivery: "no_changes",
                    submodules: [
                      checkerSubmodule({
                        path: "packaging/shared-modules/legacy-platform-dependencies",
                        status: "blocked",
                        files: [
                          "legacy-platform/patches/compatibility/fix-build-with-newer-toolchains-and-system-headers.patch",
                        ],
                      }),
                    ],
                  },
                ],
              },
              { ...evidence.history![0], observed_at: "2026-11-07T17:45:00Z" },
            ],
          } satisfies Health),
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

export const MultipleBranches: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            diagnostics: [],
            sources: ["branch/25.08", "branch/26.08"].flatMap((branch) =>
              ["node", "yarn"].map((module, index) => ({
                branch,
                source: checkerSource({
                  module,
                  manifest: "org.freedesktop.Sdk.Extension.node22.yaml",
                  source_pointer: `/modules/${index}/sources/0`,
                }),
                observed_at: evidence.last_check_at!,
                run_url: evidence.history![0].run_url,
              })),
            ),
          } satisfies Health),
        ),
      ],
    },
  },
}

export const SingleBranch: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            diagnostics: [],
            sources: ["node", "yarn"].map((module, index) => ({
              branch: null,
              source: checkerSource({
                module,
                manifest: "org.freedesktop.Sdk.Extension.node22.yaml",
                source_pointer: `/modules/${index}/sources/0`,
              }),
              observed_at: evidence.last_check_at!,
              run_url: evidence.history![0].run_url,
            })),
          } satisfies Health),
        ),
      ],
    },
  },
}

export const MixedObservationDates: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            diagnostics: [],
            sources: ["node", "yarn"].map((module, index) => ({
              branch: "branch/26.08",
              source: checkerSource({
                module,
                manifest: "org.freedesktop.Sdk.Extension.node22.yaml",
                source_pointer: `/modules/${index}/sources/0`,
              }),
              observed_at:
                index === 0 ? evidence.last_check_at! : "2026-11-07T17:45:00Z",
              run_url: evidence.history![0].run_url,
            })),
          } satisfies Health),
        ),
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
      <div className="rounded-xl bg-flathub-white p-[clamp(18px,2.5vw,28px)] shadow-sm dark:bg-flathub-arsenic">
        <h2 className="mb-6 text-xl font-semibold">Maintenance</h2>
        <AppMaintenance appId={appId} />
      </div>
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

export const CheckedSourcesInMaintenancePanel: Story = {
  render: InMaintenancePanel.render,
  parameters: {
    msw: {
      handlers: [
        http.get("*/apps/org.example.App/checker-health", () =>
          HttpResponse.json({
            ...evidence,
            diagnostics: [],
            sources: Array.from({ length: 152 }, (_, index) => {
              const modules = [
                "libopenmpt",
                "libde265",
                "libheif",
                "libraw",
                "libhdhomerun",
                "libssh",
                "dav1d",
                "ffmpeg",
                "libbluray",
                "libcdio",
              ]
              return {
                branch: null,
                source: checkerSource({
                  module: modules[index] ?? `dependency-${index}`,
                  manifest:
                    index < 5
                      ? `addons/${modules[index]}/${modules[index]}.json`
                      : "tv.kodi.Kodi.yml",
                  source_pointer: `/modules/${index}/sources/0`,
                  status: index < 42 ? "checked" : "unchecked",
                  checker_type: index < 42 ? "anitya" : null,
                  checkers_run: index < 42 ? ["AnityaChecker"] : [],
                  reason: index < 42 ? null : "no_update_checker",
                  current: {
                    ...checkerSource().current,
                    version: [
                      "0.8.3",
                      "1.0.16",
                      "1.20.2",
                      "0.21.4",
                      "20250818",
                      "0.11.3",
                      "1.5.1",
                      "7.1.2",
                      "1.4.0",
                      "2.2.0",
                    ][index % 10],
                  },
                }),
                observed_at: evidence.last_check_at!,
                run_url: evidence.history![0].run_url,
              }
            }),
          } satisfies Health),
        ),
        http.get("*/summary/org.example.App", () =>
          HttpResponse.json({
            metadata: {
              runtime: "org.freedesktop.Platform/x86_64/26.08",
              runtimeIsEol: false,
            },
          }),
        ),
      ],
    },
  },
}
