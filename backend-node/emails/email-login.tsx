import { Link, Text } from "react-email"
import { Base } from "./base"

interface EmailLoginEmailProps {
  category: "email_login"
  subject: string
  signInUrl: string
  expiresAt: string
  previewText: string
}

function formatExpiration(expiresAt: string) {
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(expiresAt))

  return `${formatted} UTC`
}

export function createEmailLoginText(signInUrl: string, expiresAt: string) {
  return [
    "Sign in to Flathub",
    "",
    "Use the link below to sign in. If this is your first time, Flathub will create an account for you.",
    "",
    signInUrl,
    "",
    `This link expires in 15 minutes (at ${formatExpiration(expiresAt)}).`,
    "If you did not request this email, you can ignore it.",
  ].join("\n")
}

export const EmailLoginEmail = ({
  category,
  subject,
  signInUrl,
  expiresAt,
  previewText,
}: EmailLoginEmailProps) => (
  <Base previewText={previewText} subject={subject} category={category}>
    <Text>Use this link to sign in to Flathub.</Text>
    <Text className="-mt-4">
      If this is your first time, Flathub will create an account for you.
    </Text>
    <Text>
      <Link href={signInUrl}>Sign in to Flathub</Link>
    </Text>
    <Text>This link expires in 15 minutes (at {formatExpiration(expiresAt)}).</Text>
    <Text>If you did not request this email, you can ignore it.</Text>
  </Base>
)

EmailLoginEmail.PreviewProps = {
  category: "email_login",
  subject: "Sign in to Flathub",
  signInUrl: "https://flathub.org/en/login/email/confirm#token=token",
  expiresAt: "2026-01-01T00:15:00.000Z",
  previewText: "Sign in to Flathub",
} as EmailLoginEmailProps

export default EmailLoginEmail
