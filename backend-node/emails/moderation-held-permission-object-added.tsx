import ModerationHeldEmail, {
  ModerationHeldEmailProps,
} from "./moderation-held";

ModerationHeldEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was held for moderation",
  previewText: "Your app was held",
  category: "moderation_held",
  buildId: 123,
  jobId: 456,
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
        currentValues: {
          shared: ["network", "ipc"],
        },
      },
      isNewSubmission: false,
    },
  ],
  requests_count: 1,
} as ModerationHeldEmailProps;

export default ModerationHeldEmail;
