import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { render } from "@react-email/render";
import SecurityLoginEmail from "../emails/security-login";
import { sendMail } from "./mail";
import "dotenv/config";
import BuildNotificationEmail from "../emails/build-notification";
import ModerationHeldEmail from "../emails/moderation-held";
import ModerationRejectedEmail from "../emails/moderation-rejected";
import UploadTokenCreatedEmail from "../emails/upload-token-created";
import ModerationApprovedEmail from "../emails/moderation-approved";
import DeveloperLeftEmail from "../emails/developer-left";
import DeveloperInviteDeclinedEmail from "../emails/developer-invite-declined";
import DeveloperInviteAcceptedEmail from "../emails/developer-invite-accepted";
import DeveloperInviteEmail from "../emails/developer-invite";

const EmailBody = z.object({
  messageId: z.string().min(3).openapi({
    example: "1212121",
  }),
  references: z.string().min(3).optional().openapi({
    example: "1212121",
  }),
  from: z.string().min(3).openapi({
    example: "noreply@flathub.org",
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
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
    }),
    z.object({
      category: z
        .literal("upload_token_created")
        .openapi({ example: "upload_token_created" }),
    }),
    z.object({
      category: z
        .literal("moderation_rejected")
        .openapi({ example: "moderation_rejected" }),
    }),
    z.object({
      category: z
        .literal("moderation_held")
        .openapi({ example: "moderation_held" }),
      buildId: z.number().openapi({ example: 1 }),
      jobId: z.number().openapi({ example: 1 }),
      buildLogUrl: z.string().openapi({ example: "https://flathub.org" }),
      requests: z.array(
        z.object({
          requestType: z.literal("appdata"),
          requestData: z.object({
            keys: z.record(
              z.union([
                z.string(),
                z.array(z.string()),
                z.boolean(),
                z.record(
                  z.union([z.array(z.string()), z.record(z.array(z.string()))])
                ),
              ])
            ),
            currentValues: z.record(
              z.union([
                z.string(),
                z.array(z.string()),
                z.boolean(),
                z.record(
                  z.union([z.array(z.string()), z.record(z.array(z.string()))])
                ),
              ])
            ),
          }),
          isNewSubmission: z.boolean(),
        })
      ),
    }),
    z.object({
      category: z
        .literal("moderation_approved")
        .openapi({ example: "moderation_approved" }),
    }),
    z.object({
      category: z
        .literal("developer_left")
        .openapi({ example: "developer_left" }),
    }),
    z.object({
      category: z
        .literal("developer_invite")
        .openapi({ example: "developer_invite" }),
    }),
    z.object({
      category: z
        .literal("developer_invite_accepted")
        .openapi({ example: "developer_invite_accepted" }),
    }),
    z.object({
      category: z
        .literal("developer_invite_declined")
        .openapi({ example: "developer_invite_declined" }),
    }),
    z.object({
      category: z
        .literal("build_notification")
        .openapi({ example: "build_notification" }),
      diagnostics: z
        .array(z.any())
        .openapi({ example: ["problem 1", "problem 2"] }),
      anyWarnings: z.boolean().openapi({ example: true }),
      anyErrors: z.boolean().openapi({ example: true }),
      buildId: z.number().openapi({ example: 1 }),
      buildRepo: z.string().openapi({ example: "repo" }),
      appId: z.string().min(3).openapi({ example: "tv.kodi.Kodi" }),
      appName: z.string().min(2).optional().openapi({ example: "Kodi" }),
    }),
  ]),
});

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
});
const app = new OpenAPIHono();

app.openapi(route, async (c) => {
  const { messageId, references, from, to, subject, messageInfo, previewText } =
    c.req.valid("json");

  let emailHtml = undefined;

  if (messageInfo.category === "security_login") {
    emailHtml = render(
      SecurityLoginEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "build_notification") {
    emailHtml = render(
      BuildNotificationEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "developer_invite") {
    emailHtml = render(
      DeveloperInviteEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "developer_invite_accepted") {
    emailHtml = render(
      DeveloperInviteAcceptedEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "developer_invite_declined") {
    emailHtml = render(
      DeveloperInviteDeclinedEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "developer_left") {
    emailHtml = render(
      DeveloperLeftEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "moderation_approved") {
    emailHtml = render(
      ModerationApprovedEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "moderation_held") {
    emailHtml = render(
      ModerationHeldEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "moderation_rejected") {
    emailHtml = render(
      ModerationRejectedEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  } else if (messageInfo.category === "upload_token_created") {
    emailHtml = render(
      UploadTokenCreatedEmail({
        subject,
        previewText,
        ...messageInfo,
      })
    );
  }

  if (!emailHtml) {
    return c.notFound();
  }

  await sendMail({
    category: messageInfo.category,
    messageId,
    from,
    to,
    subject,
    emailHtml,
    references,
  });

  c.status(204);
  return c.json({});
});

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Flathub Email API",
  },
});

app.get("/docs", swaggerUI({ url: "/doc" }));

const port = 8001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
