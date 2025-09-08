import { Meta } from "@storybook/nextjs-vite"
import AppstreamChangesRow from "./AppstreamChangesRow"
import { faker } from "@faker-js/faker"
import { ModerationRequestResponse } from "../../codegen/model"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/AppstreamChangesRow",
  component: AppstreamChangesRow,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => {
      queryClient.setQueryData(["moderation", "tv.abc.TestApp", 0], {
        data: {},
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof AppstreamChangesRow>

export const Primary = () => {
  const request: ModerationRequestResponse = {
    request_type: "appdata",
    request_data: {
      current_values: {
        name: "Test App",
        developer: "Kola Lamepe",
      },
      keys: {
        name: "My Awesome Test App",
        developer: "Kolja Lampe",
      },
    },
    id: 1,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: false,

    handled_by: "Kolja",
    handled_at: faker.date.past().toISOString(),
    is_approved: false,
    comment: null,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionChange = () => {
  const request: ModerationRequestResponse = {
    id: 277,
    app_id: "org.vim.Vim",
    created_at: "2024-01-14T20:26:07.457480",
    build_id: 76133,
    job_id: 127665,
    is_outdated: false,
    request_type: "appdata",
    request_data: {
      keys: {
        shared: ["network"],
      },
      current_values: {
        shared: ["network", "ipc"],
        sockets: ["x11"],
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionChangeAdded = () => {
  const request: ModerationRequestResponse = {
    id: 277,
    app_id: "org.vim.Vim",
    created_at: "2024-01-14T20:26:07.457480",
    build_id: 76133,
    job_id: 127665,
    is_outdated: false,
    request_type: "appdata",
    request_data: {
      keys: {
        shared: ["network", "ipc"],
        sockets: ["x11"],
      },
      current_values: {
        shared: ["network"],
        sockets: ["x11"],
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionChangeRemoval = () => {
  const request: ModerationRequestResponse = {
    id: 284,
    app_id: "org.vim.Vim",
    created_at: "2024-01-15T15:54:53.392205",
    build_id: 76271,
    job_id: 127964,
    is_outdated: false,
    request_type: "appdata",
    request_data: {
      keys: {
        shared: ["network"],
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        shared: ["network", "ipc"],
        sockets: ["x11"],
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionObjectChangeAdded = () => {
  const request: ModerationRequestResponse = {
    id: 277,
    app_id: "org.vim.Vim",
    created_at: "2024-01-14T20:26:07.457480",
    build_id: 76133,
    job_id: 127665,
    is_outdated: false,
    request_type: "appdata",
    request_data: {
      keys: {
        shared: ["network"],
        "session-bus talk": {
          talk: ["org.freedesktop.flatpak"],
        },
      },
      current_values: {
        shared: ["network", "ipc"],
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionObjectChangeRemoval = () => {
  const request: ModerationRequestResponse = {
    id: 277,
    app_id: "org.vim.Vim",
    created_at: "2024-01-14T20:26:07.457480",
    build_id: 76133,
    job_id: 127665,
    is_outdated: false,
    request_type: "appdata",
    request_data: {
      keys: {
        shared: ["network"],
        sockets: ["x11"],
      },
      current_values: {
        shared: ["network", "ipc"],
        sockets: ["x11"],
        filesystems: ["/var/tmp", "/tmp", "host"],
        "session-bus talk": {
          talk: ["org.freedesktop.flatpak"],
        },
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}
