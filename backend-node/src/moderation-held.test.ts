import assert from "node:assert/strict"
import test from "node:test"
import { render } from "react-email"
import ModerationHeldEmail, { type Request } from "../emails/moderation-held"
import ModerationApprovedEmail from "../emails/moderation-approved"
import ModerationRejectedEmail from "../emails/moderation-rejected"

const randomRequest: Request = {
  requestType: "appdata",
  requestData: {
    keys: {
      human_review: "Randomly selected for human review",
    },
    current_values: {},
  },
  isNewSubmission: false,
}

test("renders random human review without a metadata diff", async () => {
  const html = await render(
    ModerationHeldEmail({
      category: "moderation_held",
      subject: "Build #123 selected for human review",
      previewText: "Build #123 selected for human review",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      requests: [randomRequest],
    }),
  )

  assert.match(html, /selected for human review/)
  assert.match(html, /Reason: (?:<!-- -->)?Randomly selected for human review/)
  assert.doesNotMatch(html, /Old value/)
  assert.doesNotMatch(html, /metadata has changed/)
})

test("renders random approval without a metadata diff", async () => {
  const html = await render(
    ModerationApprovedEmail({
      category: "moderation_approved",
      subject: "Build #123 selected for human review was approved",
      previewText: "Build #123 selected for human review was approved",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: randomRequest,
    }),
  )

  assert.match(html, /selected for human review and approved/)
  assert.match(html, /Reason: (?:<!-- -->)?Randomly selected for human review/)
  assert.doesNotMatch(html, /Old value/)
})

test("renders random rejection without a metadata diff", async () => {
  const html = await render(
    ModerationRejectedEmail({
      category: "moderation_rejected",
      subject: "Build #123 selected for human review was rejected",
      previewText: "Build #123 selected for human review was rejected",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: randomRequest,
      comment: "Not acceptable",
    }),
  )

  assert.match(html, /selected for human review and rejected/)
  assert.match(html, /Reason: (?:<!-- -->)?Randomly selected for human review/)
  assert.doesNotMatch(html, /Old value/)
})
