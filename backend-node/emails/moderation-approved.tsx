import { Heading, Section, Text } from "react-email"
import { Base, buildAppName } from "./base"
import {
  ModerationEmailProps,
  RANDOM_REVIEW_MARKER,
  Request,
  isRandomReviewRequest,
} from "./moderation-held"
import { BuildLog } from "./buildlog"

export const ModerationApprovedEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  buildId,
  buildLogUrl,
  request,
  comment,
}: Omit<ModerationEmailProps, "requests"> & {
  request: Request
  comment?: string
}) => {
  const appNameAndId = buildAppName(appId, appName)

  const isRandomReview = isRandomReviewRequest(request)

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        {isRandomReview ? (
          <>
            Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
            <b>{appNameAndId}</b> was selected for human review and approved by
            the Flathub team.
          </>
        ) : (
          <>
            A change in build{" "}
            <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
            <b>{appNameAndId}</b> has been reviewed and approved by the Flathub
            team.
          </>
        )}
      </Text>
      {comment && (
        <Section>
          <Heading as="h4">Comment</Heading>
          <blockquote className="text-sm">{comment}</blockquote>
        </Section>
      )}
      {isRandomReview && <Text>Reason: {RANDOM_REVIEW_MARKER}.</Text>}
    </Base>
  )
}

ModerationApprovedEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was approved",
  previewText: "Your app was successfully reviewed",
  category: "moderation_approved",
  buildId: 123,
  buildLogUrl: "https://flathub.org",
  comment: "Nice work",
  request: {
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
} as Omit<ModerationEmailProps, "requests">

export default ModerationApprovedEmail
