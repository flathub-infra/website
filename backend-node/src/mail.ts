import { createTransport } from "nodemailer"
import { Headers, Options } from "nodemailer/lib/mailer"

export async function sendMail({
  category,
  messageId,
  references,
  from,
  to,
  subject,
  emailHtml,
}: {
  category: string
  messageId: string
  references?: string
  from: string
  to: string
  subject: string
  emailHtml: any
}) {
  const transporter = createTransport({
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT) || 2525,
    secure: false,
    auth: {
      user: process.env.USERNAME,
      pass: process.env.PASSWORD,
    },
  })

  const headers: Headers = {
    "X-Flathub-Reason": category,
  }

  const options: Options = {
    messageId: messageId,
    references: references,
    inReplyTo: references,
    from: from,
    to: to,
    subject: subject,
    html: emailHtml,
    headers: headers,
  }

  await transporter.sendMail(options)
}
