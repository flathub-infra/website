import { Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

interface DeveloperLeftEmailProps {
  appId: string
  appName: string | null
  category: "developer_left"
  subject: string
  previewText: string
  login: string
}

export const DeveloperLeftEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  login,
}: DeveloperLeftEmailProps) => {
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
        <b>{login}</b> left the developer team of <b>{appNameAndId}</b>.
      </Text>
    </Base>
  )
}

DeveloperLeftEmail.PreviewProps = {
  appId: "org.flatpak.Hello",
  appName: "Hello",
  subject: "Developer left app",
  previewText: "A developer left the app you are maintaining",
  category: "developer_left",
  login: "testuser",
} as DeveloperLeftEmailProps

export default DeveloperLeftEmail
