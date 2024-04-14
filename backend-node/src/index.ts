import { serve } from "@hono/node-server"
import { swaggerUI } from "@hono/swagger-ui"
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"
import { render } from "@react-email/render"
import SecurityLoginEmail from "../emails/security-login"
import { sendMail } from "./mail"
import "dotenv/config"
import BuildNotificationEmail from "../emails/build-notification"
import ModerationHeldEmail from "../emails/moderation-held"
import ModerationRejectedEmail from "../emails/moderation-rejected"
import UploadTokenCreatedEmail from "../emails/upload-token-created"
import ModerationApprovedEmail from "../emails/moderation-approved"
import DeveloperLeftEmail from "../emails/developer-left"
import DeveloperInviteDeclinedEmail from "../emails/developer-invite-declined"
import DeveloperInviteAcceptedEmail from "../emails/developer-invite-accepted"
import DeveloperInviteEmail from "../emails/developer-invite"
import { logger } from "hono/logger"

const RequestSchema = z.object({
  requestType: z.literal("appdata"),
  requestData: z.object({
    keys: z.record(
      z.union([
        z.string(),
        z.array(z.string()),
        z.boolean(),
        z.record(z.union([z.array(z.string()), z.record(z.array(z.string()))])),
      ]),
    ),
    current_values: z.record(
      z.union([
        z.string(),
        z.array(z.string()),
        z.boolean(),
        z.record(z.union([z.array(z.string()), z.record(z.array(z.string()))])),
      ]),
    ),
  }),
  isNewSubmission: z.boolean(),
})

const EmailBody = z.object({
  messageId: z.string().min(3).openapi({
    example: "1212121",
  }),
  to: z.string().min(3).openapi({
    example: "test@flathub.org",
  }),
  subject: z.string().min(3).openapi({
    example: "Test subject",
  }),
  previewText: z.string().min(3).openapi({
    example: "New login to Flathub account",
  }),
  messageInfo: z.discriminatedUnion("category", [
    z.object({
      category: z
        .literal("security_login")
        .openapi({ example: "security_login" }),
      provider: z.string().min(3).openapi({ example: "github" }),
      login: z.string().min(1).openapi({ example: "testuser" }),
      time: z.string().min(3).openapi({ example: "2011-10-05T14:48:00.000Z" }),
      ipAddress: z.string().min(3).openapi({ example: "127.0.0.1" }),
    }),
    z.object({
      category: z
        .literal("upload_token_created")
        .openapi({ example: "upload_token_created" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      issuedTo: z.string().min(2).openapi({ example: "username" }),
      comment: z.string().min(2).openapi({ example: "My token" }),
      expiresAt: z.string().min(2).openapi({ example: "Tomorrow" }),
      scopes: z
        .array(z.string())
        .openapi({ example: ["build", "upload", "publish"] }),
      repos: z.array(z.string()).openapi({ example: ["stable", "beta"] }),
    }),
    z.object({
      category: z
        .literal("moderation_rejected")
        .openapi({ example: "moderation_rejected" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      buildId: z.number().openapi({ example: 1 }),
      buildLogUrl: z.string().openapi({ example: "https://flathub.org" }),
      comment: z.string().openapi({ example: "There is something wrong" }),
      request: RequestSchema,
      references: z.string().min(3).openapi({
        example: "1212121",
      }),
    }),
    z.object({
      category: z
        .literal("moderation_held")
        .openapi({ example: "moderation_held" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      buildId: z.number().openapi({ example: 1 }),
      buildLogUrl: z.string().openapi({ example: "https://flathub.org" }),
      requests: z.array(RequestSchema),
    }),
    z.object({
      category: z
        .literal("moderation_approved")
        .openapi({ example: "moderation_approved" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      buildId: z.number().openapi({ example: 1 }),
      buildLogUrl: z.string().openapi({ example: "https://flathub.org" }),
      comment: z
        .string()
        .optional()
        .openapi({ example: "There is something wrong" }),
      request: RequestSchema,
      references: z.string().min(3).openapi({
        example: "1212121",
      }),
    }),
    z.object({
      category: z
        .literal("developer_left")
        .openapi({ example: "developer_left" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      login: z.string().min(2).openapi({ example: "testuser" }),
    }),
    z.object({
      category: z
        .literal("developer_invite")
        .openapi({ example: "developer_invite" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      inviter: z.string().min(2).openapi({ example: "testuser" }),
    }),
    z.object({
      category: z
        .literal("developer_invite_accepted")
        .openapi({ example: "developer_invite_accepted" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      login: z.string().min(2).openapi({ example: "testuser" }),
      references: z.string().min(3).openapi({
        example: "1212121",
      }),
    }),
    z.object({
      category: z
        .literal("developer_invite_declined")
        .openapi({ example: "developer_invite_declined" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      login: z.string().min(2).openapi({ example: "testuser" }),
      references: z.string().min(3).openapi({
        example: "1212121",
      }),
    }),
    z.object({
      category: z
        .literal("build_notification")
        .openapi({ example: "build_notification" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
      diagnostics: z
        .array(z.any())
        .openapi({ example: ["problem 1", "problem 2"] }),
      anyWarnings: z.boolean().openapi({ example: true }),
      anyErrors: z.boolean().openapi({ example: true }),
      buildId: z.number().openapi({ example: 1 }),
      buildRepo: z.string().openapi({ example: "repo" }),
    }),
  ]),
})

const route = createRoute({
  method: "post",
  path: "/emails",
  request: {
    body: {
      content: { "application/json": { schema: EmailBody } },
      required: true,
    },
  },
  responses: {
    204: {
      content: {},
      description: "",
    },
  },
})
const app = new OpenAPIHono()

app.use(logger())

app.openapi(route, async (c) => {
  const { messageId, to, subject, messageInfo, previewText } =
    c.req.valid("json")

  let emailHtml = undefined

  if (messageInfo.category === "security_login") {
    emailHtml = render(
      SecurityLoginEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "build_notification") {
    emailHtml = render(
      BuildNotificationEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "developer_invite") {
    emailHtml = render(
      DeveloperInviteEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "developer_invite_accepted") {
    emailHtml = render(
      DeveloperInviteAcceptedEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "developer_invite_declined") {
    emailHtml = render(
      DeveloperInviteDeclinedEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "developer_left") {
    emailHtml = render(
      DeveloperLeftEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "moderation_approved") {
    emailHtml = render(
      ModerationApprovedEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "moderation_held") {
    emailHtml = render(
      ModerationHeldEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "moderation_rejected") {
    emailHtml = render(
      ModerationRejectedEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  } else if (messageInfo.category === "upload_token_created") {
    emailHtml = render(
      UploadTokenCreatedEmail({
        subject,
        previewText,
        ...messageInfo,
      }),
    )
  }

  // if (!emailHtml) {
  //   return c.notFound();
  // }

  await sendMail({
    category: messageInfo.category,
    messageId,
    to,
    subject,
    emailHtml,
    references:
      "references" in messageInfo ? messageInfo.references : undefined,
  })

  // c.status(204)
  return c.json({})
})

// The OpenAPI documentation will be available at /doc
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Flathub Email API",
  },
})

app.get("/docs", swaggerUI({ url: "/openapi.json" }))

const port = 8001
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})
