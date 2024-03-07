import { Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface DeveloperInviteAcceptedEmailProps {
  appId: string
  appName?: string
  category: "developer_invite_accepted"
  subject: string
  previewText: string
  login: string
}

export const DeveloperInviteAcceptedEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  login,
}: DeveloperInviteAcceptedEmailProps) => {
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
        {login} accepted their invite and is now a developer of {appNameAndId}{" "}
        on Flathub.
      </Text>
    </Base>
  )
}

DeveloperInviteAcceptedEmail.PreviewProps = {
  appId: "org.flatpak.Hello",
  appName: "Hello",
  subject: "Invite acceped",
  previewText: "A user accepted their invite",
  category: "developer_invite_accepted",
  login: "testuser",
} as DeveloperInviteAcceptedEmailProps

export default DeveloperInviteAcceptedEmail
