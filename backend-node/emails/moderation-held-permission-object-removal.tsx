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
          shared: ["network"],
          sockets: ["x11"],
          filesystems: null,
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
      isNewSubmission: false,
    },
  ],
  requests_count: 1,
} as ModerationEmailProps

export default ModerationHeldEmail
