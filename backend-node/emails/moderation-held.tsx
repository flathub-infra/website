import { Link, Text } from "react-email"
import { Base, buildAppName } from "./base"
import { BuildLog } from "./buildlog"

export interface ModerationEmailProps {
  appId: string
  appName: string | null
  category: "moderation_approved" | "moderation_held" | "moderation_rejected"
  subject: string
  previewText: string
  buildId: number
  buildLogUrl: string | null
  requests: Request[]
}

export interface AppdataRequest {
  requestType: "appdata"
  requestData: {
    keys: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
        | null
    }
    current_values: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
        | null
    }
  }
  isNewSubmission: boolean
}

interface ManifestFinding {
  origins_added: string[]
  origins_removed: string[]
  locations_by_origin: Record<string, string[]>
  arches: string[]
}

export interface ManifestRequest {
  requestType: "manifest"
  requestData: {
    findings: ManifestFinding[]
    complexity?: unknown
  }
  isNewSubmission: false
}

export type Request = AppdataRequest | ManifestRequest

export const RANDOM_REVIEW_MARKER = "Randomly selected for human review"

export function isRandomReviewRequest(
  request: Request,
): request is AppdataRequest {
  return (
    request.requestType === "appdata" &&
    request.requestData.keys.human_review === RANDOM_REVIEW_MARKER &&
    Object.keys(request.requestData.keys).length === 1 &&
    Object.keys(request.requestData.current_values).length === 0
  )
}

export const ModerationHeldEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  buildId,
  buildLogUrl,
  requests,
}: ModerationEmailProps) => {
  const appNameAndId = buildAppName(appId, appName)

  const isRandomReview =
    requests.length > 0 && requests.every(isRandomReviewRequest)
  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      {isRandomReview ? (
        <Text>
          Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
          <b>{appNameAndId}</b> has been selected for human review. Check the
          status of the review in the{" "}
          <Link href={`https://flathub.org/apps/manage/${appId}`}>
            app developer settings
          </Link>
          .
        </Text>
      ) : (
        <Text>
          Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
          <b>{appNameAndId}</b> has been held for review. Check the status of
          the review in the{" "}
          <Link href={`https://flathub.org/apps/manage/${appId}`}>
            app developer settings
          </Link>
          .
        </Text>
      )}
      <Text>
        {isRandomReview
          ? "You'll receive another email when the review is approved or rejected."
          : "You'll receive another email when the changes are approved or rejected."}
      </Text>
      {isRandomReview && <Text>Reason: {RANDOM_REVIEW_MARKER}.</Text>}
    </Base>
  )
}

ModerationHeldEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was held for moderation",
  previewText: "Your app was held",
  category: "moderation_held",
  buildId: 123,
  buildLogUrl: "https://flathub.org/",
  requests: [
    {
      requestType: "appdata",
      requestData: {
        keys: {
          name: "My Awesome Test App",
        },
        current_values: {
          name: "Test App",
        },
      },
      isNewSubmission: false,
    },
  ],
} as ModerationEmailProps

export default ModerationHeldEmail
