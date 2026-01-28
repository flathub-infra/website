import { createTransport } from "nodemailer"
import { Headers, Options } from "nodemailer/lib/mailer"

const DEFAULT_MESSAGE_ID_DOMAIN = "flathub.org"

function normalizeMessageId(rawId: string): string {
  const trimmed = rawId.trim()
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed
  }

  if (trimmed.includes("@")) {
    return `<${trimmed}>`
  }

  return `<${trimmed}@${DEFAULT_MESSAGE_ID_DOMAIN}>`
}

export async function sendMail({
  category,
  messageId,
  references,
  to,
  subject,
  emailHtml,
}: {
  category: string
  messageId: string
  references?: string
  to: string
  subject: string
  emailHtml: any
}) {
  const transporter = createTransport({
    host: process.env.HOST || "smtp-test-server",
    port: Number(process.env.PORT) || 25,
    secure: false,
    auth:
      process.env.USERNAME && process.env.PASSWORD
        ? {
            user: process.env.USERNAME,
            pass: process.env.PASSWORD,
          }
        : undefined,
  })

  const headers: Headers = {
    "X-Flathub-Reason": category,
  }

  const normalizedMessageId = normalizeMessageId(messageId)
  const normalizedReferences = references
    ? normalizeMessageId(references)
    : undefined

  const options: Options = {
    messageId: normalizedMessageId,
    references: normalizedReferences,
    inReplyTo: normalizedReferences,
    from: "Flathub <noreply@flathub.org >",
    to: to,
    subject: subject,
    html: emailHtml,
    headers: headers,
  }

  await transporter.sendMail(options)
}
