import { Heading, Section, Text } from "react-email"
import { Base, buildAppName } from "./base"
import {
  ModerationEmailProps,
  ModerationRequestItem,
  RANDOM_REVIEW_MARKER,
  Request,
  isRandomReviewRequest,
} from "./moderation-held"
import { BuildLog } from "./buildlog"

export const ModerationRejectedEmail = ({
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
  comment: string
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
            <b>{appNameAndId}</b> was selected for human review and rejected by
            the Flathub team.
          </>
        ) : (
          <>
            A change in build{" "}
            <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
            <b>{appNameAndId}</b> has been reviewed by the Flathub team, and the
            build has been rejected for the following reason.
          </>
        )}
      </Text>
      {comment && (
        <Section>
          <Heading as="h4">Comment</Heading>
          <blockquote className="text-sm">{comment}</blockquote>
        </Section>
      )}
      {isRandomReview ? (
        <Text>Reason: {RANDOM_REVIEW_MARKER}.</Text>
      ) : (
        <ModerationRequestItem request={request} />
      )}
    </Base>
  )
}

ModerationRejectedEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was rejected",
  previewText: "Your app failed review",
  category: "moderation_rejected",
  buildId: 123,
  buildLogUrl: "https://flathub.org/builds",
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
  comment: "Please use a better name for your app.",
} as Omit<ModerationEmailProps, "requests">

export default ModerationRejectedEmail
