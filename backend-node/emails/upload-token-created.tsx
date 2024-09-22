import { Link, Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface UploadTokenCreatedEmailProps {
  appId: string
  appName: string | null
  category: "upload_token_created"
  subject: string
  previewText: string
  issuedTo: string
  comment: string
  scopes: string[]
  repos: string[]
  expiresAt: string
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
  const appNameAndId = buildAppName(appId, appName)

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text className="pb-4">
        <b>{issuedTo}</b> has created a new upload token for{" "}
        <b>{appNameAndId}</b>.
      </Text>

      <Text className="-mt-4">
        <b>Token name: </b>
        {comment}
      </Text>

      <Text className="-mt-4">
        <b>Scopes: </b>
        {scopes.join(", ")}
      </Text>

      <Text className="-mt-4">
        <b>Repos: </b>
        {repos.join(", ")}
      </Text>

      <Text className="-mt-4">
        <b>Expires: </b>
        {expiresAt}
      </Text>

      <Text>
        If you do not recognize this activity, please{" "}
        <Link href="mailto:admins@flathub.org">contact us</Link> immediately.
      </Text>
    </Base>
  )
}

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
} as UploadTokenCreatedEmailProps

export default UploadTokenCreatedEmail
