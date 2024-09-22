import { Button, Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface DeveloperInviteEmailProps {
  appId: string
  appName: string | null
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
        <b>{inviter}</b> has invited you to join them as a developer of{" "}
        <b>{appNameAndId}</b> on Flathub.
      </Text>
      <Text>
        To accept this invite, click the link below or go to the Developer
        Portal on Flathub.
      </Text>

      <Button
        href={`${frontendUrl}/apps/manage/${appId}/accept-invite`}
        className="box-border w-full rounded-[8px] bg-flathub-celestial-blue py-[12px] text-center font-semibold text-white"
      >
        Accept Invite
      </Button>
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
