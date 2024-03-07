import { Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface DeveloperInviteEmailProps {
  appId: string
  appName?: string
  category: "developer_invite"
  subject: string
  previewText: string
  inviter: string
}

export const DeveloperInviteEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  inviter,
}: DeveloperInviteEmailProps) => {
  const appNameAndId = buildAppName(appId, appName)

  const frontendUrl = process.env.FRONTEND_URL ?? "https://flathub.org"

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        {inviter} has invited you to join them as a developer of {appNameAndId}{" "}
        on Flathub. To accept this invite, click the link below or go to the
        Developers tab of your Flathub account settings.
      </Text>

      <a href={`${frontendUrl}/apps/manage/${appId}/accept-invite`}>
        Accept Invite
      </a>
    </Base>
  )
}

DeveloperInviteEmail.PreviewProps = {
  appId: "org.flatpak.Hello",
  appName: "Hello",
  subject: "Invited to app",
  previewText: "You have been invited",
  category: "developer_invite",
  inviter: "testuser",
} as DeveloperInviteEmailProps

export default DeveloperInviteEmail
