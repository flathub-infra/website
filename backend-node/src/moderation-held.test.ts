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
        origins_added: ["https://github.com/foo/bar"],
        origins_removed: ["https://old.example"],
        locations_by_origin: {
          "https://github.com/foo/bar": [
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

const complexityRequest: Request = {
  requestType: "manifest",
  requestData: {
    findings: [],
    complexity: {
      algorithm_version: 3,
      analysis_fingerprint:
        "sha256:6ec3f8e3df4e5c77cf90e5ec66081eb8918e52c27ec1d1de7cc3b4ca28998a7e",
      score_units: 15,
      raw_score_units: 15,
      display_score: 7.5,
      threshold_units: 14,
      score_band: "large",
      score_breakdown: {
        structural_units: 5,
        recipe_units: 6,
        breadth_units: 2,
        ambiguity_units: 2,
      },
      affected_arches: ["aarch64", "x86_64"],
      touched_modules: ["modules/main", "modules/main/modules/libfoo"],
      touched_modules_truncated: true,
      total_touched_module_count: 55,
      events: [
        {
          kind: "module_match_ambiguous",
          location: "modules/main",
          arches: ["aarch64", "x86_64"],
          old_summary: { count: 2 },
          new_summary: { count: 3 },
        },
      ],
      events_truncated: true,
      total_event_count: 28,
    },
  },
  isNewSubmission: false,
}

function assertComplexityNotRendered(html: string) {
  assert.doesNotMatch(html, /Manifest packaging complexity/)
  assert.doesNotMatch(html, /packaging recipe changed broadly or structurally/)
  assert.doesNotMatch(html, /security-risk or malicious-change assessment/)
  assert.doesNotMatch(html, /Score:/)
  assert.doesNotMatch(html, /modules\/main/)
  assert.doesNotMatch(html, /module match ambiguous/)
  assert.doesNotMatch(html, /could not be matched unambiguously/)
}

function assertManifestRendering(html: string) {
  assert.match(html, /https:\/\/github\.com\/foo\/bar/)
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
  assert.match(html, /has been held for review/)
  assert.doesNotMatch(html, /held for review because/)
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

test("hides manifest complexity in held email", async () => {
  const html = await render(
    ModerationHeldEmail({
      category: "moderation_held",
      subject: "Build #123 held for review",
      previewText: "Build #123 held for review",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      requests: [complexityRequest],
    }),
  )

  assertComplexityNotRendered(html)
  assert.match(html, /has been held for review/)
})

test("hides manifest complexity in approved email", async () => {
  const html = await render(
    ModerationApprovedEmail({
      category: "moderation_approved",
      subject: "Build #123 approved",
      previewText: "Build #123 approved",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: complexityRequest,
    }),
  )

  assertComplexityNotRendered(html)
})

test("hides manifest complexity in combined rejected email", async () => {
  const combinedRequest: Request = {
    ...manifestRequest,
    requestData: {
      ...manifestRequest.requestData,
      complexity: complexityRequest.requestData.complexity,
    },
  }
  const html = await render(
    ModerationRejectedEmail({
      category: "moderation_rejected",
      subject: "Build #123 rejected",
      previewText: "Build #123 rejected",
      appId: "org.example.App",
      appName: "Example App",
      buildId: 123,
      buildLogUrl: "https://flathub.org/builds/123",
      request: combinedRequest,
      comment: "Not acceptable",
    }),
  )

  assertComplexityNotRendered(html)
  assertManifestRendering(html)
})
