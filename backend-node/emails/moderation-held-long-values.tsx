import ModerationHeldEmail, { ModerationEmailProps } from "./moderation-held"

ModerationHeldEmail.PreviewProps = {
  appId: "im.kaidan.kaidan",
  appName: "Kaidan",
  subject: "App was held for moderation",
  previewText: "Your app was held",
  category: "moderation_held",
  buildId: 231518,
  buildLogUrl: "https://flathub.org/builds/231518",
  requests: [
    {
      requestType: "appdata",
      requestData: {
        keys: {
          sockets: ["fallback-x11", "pulseaudio", "wayland", "x11"],
          "talk-session-bus": {
            talk: [
              "com.canonical.AppMenu.Registrar",
              "org.freedesktop.Notifications",
              "org.freedesktop.secrets",
              "org.kde.KGlobalSettings",
              "org.kde.kconfig.notify",
            ],
          },
        },
        current_values: {
          sockets: ["fallback-x11", "wayland", "x11"],
          "talk-session-bus": {
            talk: [
              "com.canonical.AppMenu.Registrar",
              "org.freedesktop.Notifications",
              "org.kde.KGlobalSettings",
              "org.kde.kconfig.notify",
              "org.kde.kdeconnect",
            ],
          },
        },
      },
      isNewSubmission: false,
    },
  ],
  requests_count: 1,
} as ModerationEmailProps

export default ModerationHeldEmail
