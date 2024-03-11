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
          "session-bus talk": {
            talk: ["org.freedesktop.flatpak"],
          },
        },
        current_values: {
          shared: ["network", "ipc"],
        },
      },
      isNewSubmission: false,
    },
  ],
  requests_count: 1,
} as ModerationEmailProps

export default ModerationHeldEmail
