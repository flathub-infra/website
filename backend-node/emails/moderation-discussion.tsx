import { Heading, Link, Section, Text } from "react-email"
import { Base, buildAppName } from "./base"
import { ModerationEmailProps } from "./moderation-held"
import { BuildLog } from "./buildlog"

export const ModerationDiscussionEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  buildId,
  buildLogUrl,
  comment,
  discussionUrl,
}: Omit<ModerationEmailProps, "requests" | "category"> & {
  category: "moderation_discussion"
  comment: string
  discussionUrl: string
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
        A moderator opened a discussion about build{" "}
        <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
        <b>{appNameAndId}</b>. The build remains withheld pending a review
        decision.
      </Text>
      <Section>
        <Heading as="h4">Comment</Heading>
        <blockquote className="text-sm">{comment}</blockquote>
      </Section>
      <Text>
        <Link href={discussionUrl}>View discussion</Link>
      </Text>
    </Base>
  )
}

ModerationDiscussionEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "Discussion opened for build #123",
  previewText: "Discussion opened for build #123",
  category: "moderation_discussion",
  buildId: 123,
  buildLogUrl: "https://flathub.org/builds",
  comment: "Please explain why this source changed.",
  discussionUrl: "https://github.com/flathub/org.test.Test/issues/1",
}

export default ModerationDiscussionEmail
