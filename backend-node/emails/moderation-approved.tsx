import { Heading, Section, Text } from "@react-email/components"
import { Base, buildAppName } from "./base"
import {
  ModerationEmailProps,
  ModerationRequestItem,
  Request,
} from "./moderation-held"

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

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        A change in build <a href={buildLogUrl}>#{buildId}</a> of{" "}
        <b>{appNameAndId}</b> has been reviewed and approved by the Flathub
        team.
      </Text>
      {comment && (
        <Section>
          <Heading as="h4">Comment</Heading>
          <blockquote className="text-sm">{comment}</blockquote>
        </Section>
      )}
      <ModerationRequestItem request={request} />
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
