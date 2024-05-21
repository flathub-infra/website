import { Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface DeveloperInviteDeclinedEmailProps {
  appId: string
  appName?: string
  category: "developer_invite_declined"
  subject: string
  previewText: string
  login: string
}

export const DeveloperInviteDeclinedEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  login,
}: DeveloperInviteDeclinedEmailProps) => {
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
        <b>{login}</b> declined their invite to <b>{appNameAndId}</b>.
      </Text>
    </Base>
  )
}

DeveloperInviteDeclinedEmail.PreviewProps = {
  appId: "org.flatpak.Hello",
  appName: "Hello",
  subject: "Invite declined",
  previewText: "A user declined their invite",
  category: "developer_invite_declined",
  login: "testuser",
} as DeveloperInviteDeclinedEmailProps

export default DeveloperInviteDeclinedEmail
