import { Meta } from "@storybook/nextjs-vite"
import ModerationTabs from "./ModerationTabs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { faker } from "@faker-js/faker"
import { http, HttpResponse } from "msw"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/ModerationTabs",
  component: ModerationTabs,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation",
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
} as Meta<typeof ModerationTabs>

// Generate mock apps data
const generateMockApps = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    appid: `org.example.App${i}`,
    updated_at: faker.date.recent().toISOString(),
    is_new_submission: i % 3 === 0, // Every third app is a new submission
  }))
}

export const WithPendingReviews = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: generateMockApps(15),
            apps_count: 15,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json(
            Array.from({ length: 15 }, (_, i) => ({
              id: `org.example.App${i}`,
              name: `Example App ${i}`,
              summary: `This is example app ${i}`,
              icon: "https://dl.flathub.org/media/org/gnome/TextEditor/4a225898919db9d4c99e3efb72015bde/icons/128x128/org.gnome.TextEditor.png",
              categories: ["Utility"],
            })),
          )
        }),
      ],
    },
  },
}

export const OnlyNewSubmissions = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation",
        query: { filterNew: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: generateMockApps(8).map((app) => ({
              ...app,
              is_new_submission: true,
            })),
            apps_count: 8,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json(
            Array.from({ length: 8 }, (_, i) => ({
              id: `org.example.App${i}`,
              name: `New App ${i}`,
              summary: `This is a new app submission ${i}`,
              icon: "https://dl.flathub.org/media/org/gnome/TextEditor/4a225898919db9d4c99e3efb72015bde/icons/128x128/org.gnome.TextEditor.png",
              categories: ["Utility"],
            })),
          )
        }),
      ],
    },
  },
}

export const IncludingHandled = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation",
        query: { includeHandled: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: generateMockApps(20),
            apps_count: 20,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json(
            Array.from({ length: 20 }, (_, i) => ({
              id: `org.example.App${i}`,
              name: `App ${i}`,
              summary: `App summary ${i}`,
              icon: "https://dl.flathub.org/media/org/gnome/TextEditor/4a225898919db9d4c99e3efb72015bde/icons/128x128/org.gnome.TextEditor.png",
              categories: ["Utility"],
            })),
          )
        }),
      ],
    },
  },
}

export const EmptyState = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [],
            apps_count: 0,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([])
        }),
      ],
    },
  },
}

export const Loading = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps", async () => {
          await new Promise(() => {}) // Never resolve to show loading state
          return HttpResponse.json({
            apps: [],
            apps_count: 0,
          })
        }),
      ],
    },
  },
}

export const Error = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps", () => {
          return HttpResponse.json(
            { detail: "Failed to fetch moderation apps" },
            { status: 500 },
          )
        }),
      ],
    },
  },
}
