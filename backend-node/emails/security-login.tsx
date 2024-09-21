import { Link, Text } from "@react-email/components"
import { format } from "date-fns"
import { Base } from "./base"

interface SecurityLoginEmailProps {
  category: "security_login"
  subject: string
  provider: string
  login: string
  time: string
  previewText: string
  ipAddress: string
}

export const SecurityLoginEmail = ({
  category,
  subject,
  provider,
  login,
  time,
  previewText,
  ipAddress,
}: SecurityLoginEmailProps) => {
  const formattedTime = format(time, "PPPPpppp")

  return (
    <Base previewText={previewText} subject={subject} category={category}>
      <Text>Someone recently logged into your account on Flathub.</Text>
      <Text className="-mt-4">
        If this was you, there's nothing for you to do right now.
      </Text>
      <Text>
        <b>Time: </b>
        {formattedTime}
      </Text>
      <Text className="-mt-4">
        <b>Account: </b>
        {login}
      </Text>
      <Text className="-mt-4">
        <b>Login provider: </b>
        {provider}
      </Text>
      <Text className="-mt-4">
        <b>IP address: </b>
        {ipAddress}
      </Text>
      <Text>
        If it wasn't you, please{" "}
        <Link href="mailto:admins@flathub.org">contact us</Link> immediately.
      </Text>
    </Base>
  )
}

SecurityLoginEmail.PreviewProps = {
  subject: "New login on Flathub",
  category: "security_login",
  provider: "github",
  login: "testuser",
  time: "2017-01-01T00:00:00Z",
  previewText: "New login to Flathub account",
  ipAddress: "127.0.0.1",
} as SecurityLoginEmailProps

export default SecurityLoginEmail
