import { Text } from "@react-email/components";
import { Base, buildAppName } from "./base";

interface UploadTokenCreatedEmailProps {
  appId: string;
  appName?: string;
  category: "upload_token_created";
  subject: string;
  previewText: string;
  issuedTo: string;
  comment: string;
  scopes: string[];
  repos: string[];
  expiresAt: string;
}

export const UploadTokenCreatedEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  issuedTo,
  comment,
  scopes,
  repos,
  expiresAt,
}: UploadTokenCreatedEmailProps) => {
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
        {issuedTo} has created a new upload token for {appNameAndId}.
      </Text>

      <ul>
        <li>
          <strong>Token name: </strong>
          {comment}
        </li>

        <li>
          <strong>Scopes: </strong>
          {scopes.join(", ")}
        </li>

        <li>
          <strong>Repos: </strong>
          {repos.join(", ")}
        </li>

        <li>
          <strong>Expires: </strong>
          {expiresAt}
        </li>
      </ul>

      <Text>
        If you do not recognize this activity, please contact us immediately.
      </Text>
    </Base>
  );
};

UploadTokenCreatedEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "Upload token created",
  previewText: "There is a new upload token",
  category: "upload_token_created",
  comment: "Upload token for org.flatpak.Hello",
  issuedTo: "Test User",
  scopes: ["build", "upload", "publish"],
  repos: ["stable", "beta"],
  expiresAt: "31 July 2023",
} as UploadTokenCreatedEmailProps;

export default UploadTokenCreatedEmail;
