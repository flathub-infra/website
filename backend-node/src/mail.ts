import { createTransport } from "nodemailer"
import { Headers, Options } from "nodemailer/lib/mailer"

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

  const options: Options = {
    messageId: messageId,
    references: references,
    inReplyTo: references,
    from: "Flathub <noreply@flathub.org >",
    to: to,
    subject: subject,
    html: emailHtml,
    headers: headers,
  }

  await transporter.sendMail(options)
}
