import { createHash } from "node:crypto"
import { toPlainText } from "@react-email/render"
import { createTransport } from "nodemailer"
import { Headers, Options } from "nodemailer/lib/mailer"

const DEFAULT_MESSAGE_ID_DOMAIN = "flathub.org"

export function normalizeMessageId(rawId: string): string {
  const trimmed = rawId.trim()
  const bare =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1)
      : trimmed
  const candidate = bare.includes("@")
    ? bare
    : `${bare}@${DEFAULT_MESSAGE_ID_DOMAIN}`
  // Preserve existing dot-atom IDs so replies still match previously sent mail.
  const atom = "[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+"
  const dotAtom = `${atom}(?:\\.${atom})*`
  if (new RegExp(`^${dotAtom}@${dotAtom}$`).test(candidate)) {
    return `<${candidate}>`
  }

  // Invalid IDs (including timestamp-based IDs) need a stable, safe encoding.
  const digest = createHash("sha256").update(bare).digest("hex")
  return `<sha256-${digest}@${DEFAULT_MESSAGE_ID_DOMAIN}>`
}

export async function sendMail({
  category,
  messageId,
  references,
  to,
  subject,
  emailHtml,
  text,
}: {
  category: string
  messageId: string
  references?: string
  to: string
  subject: string
  emailHtml: string | undefined
  text?: string
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
    text: text ?? (emailHtml ? toPlainText(emailHtml) : undefined),
    headers: headers,
  }

  await transporter.sendMail(options)
}
