import { Heading, Text } from "@react-email/components";
import { Base, buildAppName } from "./base";
import {
  ModerationEmailProps,
  ModerationRequestItem,
  Request,
} from "./moderation-held";

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
  request: Request;
  comment: string;
}) => {
  const appNameAndId = buildAppName(appId, appName);

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        A change in build <a href={buildLogUrl}>#{buildId}</a> of {appNameAndId}{" "}
        has been reviewed by the Flathub team, and the build has been rejected
        for the following reason.
      </Text>
      {comment && (
        <>
          <Heading as="h2">Comment:</Heading>
          <blockquote>{comment}</blockquote>
        </>
      )}
      <Heading as="h2">Change:</Heading>
      <ModerationRequestItem request={request} />
    </Base>
  );
};

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
      currentValues: {
        name: "Test App",
      },
    },
    isNewSubmission: false,
  },
  comment: "Please use a better name for your app.",
} as Omit<ModerationEmailProps, "requests">;

export default ModerationRejectedEmail;
