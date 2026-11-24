import { Link, Text } from "react-email"
import { Base, buildAppName } from "./base"
import { BuildLog } from "./buildlog"

export interface ModerationEmailProps {
  appId: string
  appName: string | null
  category: "moderation_approved" | "moderation_held" | "moderation_rejected"
  subject: string
  heading?: string
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
  }
  isNewSubmission: false
}

export type SummaryRequest = Omit<AppdataRequest, "requestType"> & {
  requestType: "summary"
}

export interface PermissionsRequest {
  requestType: "permissions"
  requestData: { channel: string }
  isNewSubmission: false
}

export type Request =
  AppdataRequest | SummaryRequest | ManifestRequest | PermissionsRequest

export const ModerationHeldEmail = ({
  category,
  appId,
  appName,
  subject,
  heading,
  previewText,
  buildId,
  buildLogUrl,
}: ModerationEmailProps) => {
  const appNameAndId = buildAppName(appId, appName)
  return (
    <Base
      previewText={previewText}
      subject={subject}
      heading={heading}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
        <b>{appNameAndId}</b> has been held for review. Check the status of the
        review in the{" "}
        <Link href={`https://flathub.org/apps/manage/${appId}`}>
          app developer settings
        </Link>
        .
      </Text>
      <Text>
        You'll receive another email when the changes are approved or rejected.
      </Text>
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
