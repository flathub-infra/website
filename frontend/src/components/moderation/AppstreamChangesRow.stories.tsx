import React from "react"
import { Meta } from "@storybook/react"
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
      keys: {
        name: "My Awesome Test App",
      },
      current_values: {
        name: "Test App",
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
        permissions: {
          shared: ["network"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        permissions: {
          shared: ["network", "ipc"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
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
        permissions: {
          shared: ["network"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        permissions: {
          shared: ["network", "ipc"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}

export const PermissionChangeRemoval = () => {
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
        permissions: {
          shared: ["network"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        permissions: {
          shared: ["network", "ipc"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
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
        permissions: {
          shared: ["network"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        permissions: {
          shared: ["network", "ipc"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
        },
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
        permissions: {
          shared: ["network"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
        },
      },
      current_values: {
        name: "Vim",
        summary: "The ubiquitous text editor",
        developer_name: "Bram Moolenaar et al.",
        project_license: "Vim",
        permissions: {
          shared: ["network", "ipc"],
          sockets: ["x11"],
          filesystems: ["/var/tmp", "/tmp", "host"],
          "session-bus": { talk: ["org.freedesktop.flatpak"] },
        },
      },
    },
    is_new_submission: false,
  }

  return <AppstreamChangesRow request={request} />
}
