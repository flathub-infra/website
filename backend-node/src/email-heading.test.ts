import assert from "node:assert/strict"
import test from "node:test"
import { render, toPlainText } from "@react-email/render"
import ModerationHeldEmail from "../emails/moderation-held"
import ModerationApprovedEmail from "../emails/moderation-approved"
import ModerationRejectedEmail from "../emails/moderation-rejected"
import ModerationDiscussionEmail from "../emails/moderation-discussion"

const props = {
  subject: "Example App | Review of build #123",
  previewText: "Review update",
  appId: "org.example.App",
  appName: "Example App",
  buildId: 123,
  buildLogUrl: "https://example.org/build/123",
}
const request = {
  requestType: "appdata" as const,
  requestData: { keys: {}, current_values: {} },
  isNewSubmission: false,
}

for (const heading of ["A separate event heading", undefined]) {
  test(`moderation templates use ${heading ? "a separate heading" : "the subject as a fallback"}`, async () => {
    const shared = { ...props, heading }
    const templates = [
      ModerationHeldEmail({
        ...shared,
        category: "moderation_held",
        requests: [request],
      }),
      ModerationApprovedEmail({
        ...shared,
        category: "moderation_approved",
        request,
      }),
      ModerationRejectedEmail({
        ...shared,
        category: "moderation_rejected",
        request,
        comment: "Please update",
      }),
      ModerationDiscussionEmail({
        ...shared,
        category: "moderation_discussion",
        comment: "Please explain",
        discussionUrl: "https://example.org/discussion",
      }),
    ]
    for (const template of templates) {
      const html = await render(template)
      assert.ok(html.includes(`<title>${props.subject}</title>`))
      const visibleHeading = html.match(/<h1\b[^>]*>(.*?)<\/h1>/s)?.[1]
      assert.equal(visibleHeading, heading ?? props.subject)
      assert.ok(
        toPlainText(html).includes((heading ?? props.subject).toUpperCase()),
      )
    }
  })
}
