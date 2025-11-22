import ModerationHeldEmail, { ModerationEmailProps } from "./moderation-held"

ModerationHeldEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was held for moderation",
  previewText: "Your app was held",
  category: "moderation_held",
  buildId: 123,
  buildLogUrl: "https://flathub.org",
  requests: [
    {
      requestType: "appdata",
      requestData: {
        keys: {
          "extra-data": false,
          keywords: ["editor", "terminal", "text", "vim"],
          permissions: {
            shared: ["network"],
            sockets: ["x11"],
            filesystems: ["/var/tmp", "/tmp", "host"],
            "session-bus": {
              talk: ["org.freedesktop.flatpak", "iuaoeuae"],
            },
          },
        },
        current_values: {
          name: "Vim",
          summary: "The ubiquitous text editor",
          developer_name: "Bram Moolenaar et al.",
          project_license: "Vim",
          "extra-data": true,
          keywords: ["editor", "text", "vim"],
          permissions: {
            shared: ["network", "ipc"],
            sockets: ["x11"],
            filesystems: ["/var/tmp", "/tmp", "host"],
            "session-bus": {
              talk: ["org.freedesktop.flatpak"],
            },
          },
        },
      },
      isNewSubmission: false,
    },
  ],
  requests_count: 1,
} as ModerationEmailProps

export default ModerationHeldEmail
