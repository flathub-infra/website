import { Meta } from "@storybook/nextjs-vite"
import AppModeration from "./AppModeration"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { faker } from "@faker-js/faker"
import { http, HttpResponse } from "msw"
import { ModerationRequestResponse } from "../../codegen/model"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/AppModeration",
  component: AppModeration,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: {},
      },
    },
  },
  decorators: [
    (Story) => {
      return (
        <QueryClientProvider client={queryClient}>
          <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof AppModeration>

const generateMockRequest = (
  id: number,
  isHandled: boolean = false,
  isOutdated: boolean = false,
): ModerationRequestResponse => ({
  id,
  app_id: "org.gnome.TextEditor",
  created_at: faker.date.recent({ days: 7 }).toISOString(),
  build_id: faker.number.int({ min: 100000, max: 200000 }),
  job_id: faker.number.int({ min: 100000, max: 300000 }),
  is_outdated: isOutdated,
  request_type: "appdata",
  request_data: {
    keys: {
      name: "GNOME Text Editor",
      summary: "Edit text files",
      description: "A simple text editor for GNOME",
    },
    current_values: {
      name: "Text Editor",
      summary: "Edit text files",
      description: "Text editor for the GNOME desktop",
    },
  },
  is_new_submission: false,
  handled_by: isHandled ? "John Doe" : null,
  handled_at: isHandled ? faker.date.recent({ days: 2 }).toISOString() : null,
  is_approved: isHandled ? true : null,
  comment: isHandled ? "Looks good!" : null,
})

const mockAppInfo = {
  id: "org.gnome.TextEditor",
  name: "GNOME Text Editor",
  summary: "Edit text files",
  icon: "https://dl.flathub.org/media/org/gnome/TextEditor/4a225898919db9d4c99e3efb72015bde/icons/128x128/org.gnome.TextEditor.png",
  categories: ["Utility", "TextEditor"],
  metadata: {
    "flathub::manifest":
      "https://github.com/flathub/org.gnome.TextEditor/blob/master/org.gnome.TextEditor.json",
  },
}

export const WithPendingRequests = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, false, false),
              generateMockRequest(2, false, false),
              generateMockRequest(3, false, false),
            ],
            requests_count: 3,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithHandledRequests = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: { includeHandled: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, true, false),
              generateMockRequest(2, true, false),
              generateMockRequest(3, false, false),
            ],
            requests_count: 3,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithOutdatedRequests = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: { includeOutdated: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, false, true),
              generateMockRequest(2, false, false),
            ],
            requests_count: 2,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const EmptyState = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [],
            requests_count: 0,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
            ],
            apps_count: 1,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithNavigation = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [generateMockRequest(1, false, false)],
            requests_count: 1,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const Loading = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", async () => {
          await new Promise(() => {}) // Never resolve to show loading state
          return HttpResponse.json({
            requests: [],
            requests_count: 0,
          })
        }),
        http.post("*/appstream", async () => {
          await new Promise(() => {}) // Never resolve to show loading state
          return HttpResponse.json([])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const Error = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json(
            { detail: "Failed to fetch moderation requests" },
            { status: 500 },
          )
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}
