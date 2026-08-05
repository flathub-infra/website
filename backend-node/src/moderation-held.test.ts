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

const manifestRequest: Request = {
  requestType: "manifest",
  requestData: {
    findings: [
      {
        origins_added: ["https://downloads.example"],
        origins_removed: ["https://old.example"],
        locations_by_origin: {
          "https://downloads.example": [
            'modules["libfoo"].sources[0].url',
            'modules["libfoo"].sources[0].mirror-urls[0]',
          ],
          "https://old.example": ['modules["libfoo"].sources[0].url'],
        },
        arches: ["aarch64", "x86_64"],
      },
    ],
  },
  isNewSubmission: false,
}

function assertManifestRendering(html: string) {
  assert.match(html, /https:\/\/downloads\.example/)
  assert.match(html, /https:\/\/old\.example/)
  assert.match(html, /libfoo/)
  assert.match(html, /aarch64/)
  assert.match(html, /x86_64/)
  assert.match(html, /Added/)
  assert.match(html, /Removed/)
  assert.equal(html.match(/libfoo/g)?.length, 1)
  assert.doesNotMatch(html, /modules\[/)
  assert.doesNotMatch(html, /\.sources/)
}

test("renders random human review without a metadata diff", async () => {
  const html = await render(
    ModerationHeldEmail({
      category: "moderation_held",
      subject: "Build #123 held for review",
      previewText: "Build #123 held for review",
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
      subject: "Build #123 approved",
      previewText: "Build #123 approved",
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
      subject: "Build #123 rejected",
      previewText: "Build #123 rejected",
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

test("renders manifest source origins in held email", async () => {
  const html = await render(
    ModerationHeldEmail({
      category: "moderation_held",
      subject: "Build #123 held for review",
      previewText: "Build #123 held for review",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      requests: [manifestRequest],
    }),
  )

  assertManifestRendering(html)
  assert.match(html, /manifest introduces a new source origin/)
  assert.doesNotMatch(html, /metadata has changed/)
})

test("renders manifest source origins in approved email", async () => {
  const html = await render(
    ModerationApprovedEmail({
      category: "moderation_approved",
      subject: "Build #123 approved",
      previewText: "Build #123 approved",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: manifestRequest,
    }),
  )

  assertManifestRendering(html)
})

test("renders manifest source origins in rejected email", async () => {
  const html = await render(
    ModerationRejectedEmail({
      category: "moderation_rejected",
      subject: "Build #123 rejected",
      previewText: "Build #123 rejected",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: manifestRequest,
      comment: "Not acceptable",
    }),
  )

  assertManifestRendering(html)
})
