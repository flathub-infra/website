import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { http, HttpResponse } from "msw"
import { expect, userEvent, within } from "storybook/test"
import { useState } from "react"
import MetadataTranslationEditor, {
  TranslationForm,
} from "./MetadataTranslationEditor"
import { UserContext } from "src/context/user-info"
import { Permission } from "src/codegen/model/permission"
import AppTranslations from "../../../app/[locale]/app-translations/[[...language]]/workspace"

const meta = {
  component: TranslationForm,
  title: "Components/Application/Listing translations",
  decorators: [
    (Story, context) =>
      context.name === "Editor" || context.name === "Source Changed" ? (
        <Story />
      ) : (
        <div className="mx-auto max-w-6xl p-4">
          <Story />
        </div>
      ),
  ],
  args: {
    appId: "net.filebot.FileBot",
    source: {
      revision: "a".repeat(40),
      path: "net.filebot.FileBot.appdata.xml",
      source_url: "https://github.com/flathub/net.filebot.FileBot",
      metadata_license: "CC0-1.0",
      locale: "de",
      can_submit: true,
      units: [
        {
          id: "/component/summary",
          field: "summary",
          context: "",
          source: "Rename media files perfectly",
          translation: "",
        },
        {
          id: "/component/description/p",
          field: "description",
          context: "",
          source:
            "FileBot is a comprehensive tool for renaming and organizing your TV shows, movies, and anime collections.",
          translation:
            "FileBot ist ein umfassendes Werkzeug zum Umbenennen und Organisieren Ihrer Serien-, Film- und Anime-Sammlungen.",
          markup: true,
        },
        {
          id: "/component/name",
          field: "name",
          context: "",
          source: "FileBot",
          translation: "",
        },
        {
          id: "/component/screenshots/screenshot/caption",
          field: "caption",
          context: "1",
          source: "FileBot rename frontend",
          translation: "",
        },
        {
          id: "/component/keywords",
          field: "keywords",
          context: "",
          source: "media\nrename",
          translation: "",
        },
        {
          id: "/component/releases/release/description/p",
          field: "release",
          context: "5.3.0",
          source: "Improved movie / series / episode auto-detection",
          translation: "",
          markup: true,
        },
      ].map((unit) => ({ ...unit, version: "initial" })),
    },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: {
      handlers: [
        http.post(
          "*/metadata-translations/:appId",
          async ({ request }): Promise<HttpResponse> => {
            const { changes } = (await request.json()) as {
              changes: Record<string, string>
            }
            return HttpResponse.json({
              url: null,
              state: "queued",
              units: meta.args.source.units.map((unit) =>
                unit.id in changes
                  ? {
                      ...unit,
                      translation: changes[unit.id],
                      version: crypto.randomUUID(),
                      last_editor_id: 42,
                    }
                  : unit,
              ),
            })
          },
        ),
      ],
    },
  },
} satisfies Meta<typeof TranslationForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Editor: Story = {
  render: () => (
    <UserContext
      value={{
        loading: false,
        info: {
          default_account: { login: "contributor", provider: "github" },
          auths: {},
          invite_code: "",
          accepted_publisher_agreement_at: null,
          permissions: [Permission["manage-apps"]],
        },
      }}
    >
      <MetadataTranslationEditor appId="net.filebot.FileBot" />
    </UserContext>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json(meta.args.source),
        ),
        ...meta.parameters.msw.handlers,
      ],
    },
  },
}

export const SourceChanged: Story = {
  render: Editor.render,
  parameters: {
    msw: {
      handlers: [
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json(meta.args.source),
        ),
        http.post("*/metadata-translations/:appId", () =>
          HttpResponse.json({ detail: "source_changed" }, { status: 409 }),
        ),
      ],
    },
  },
}

export const RightToLeft: Story = {
  args: { source: { ...meta.args.source, locale: "ar" } },
}

export const ReturnToDraft: Story = {
  render: function Navigation(args) {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button onClick={() => setOpen(!open)}>
          {open ? "Leave editor" : "Return to editor"}
        </button>
        {open && (
          <TranslationForm {...args} draftKey="storybook-return-to-draft" />
        )}
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole("textbox", { name: "Translation in German" })
    await userEvent.clear(field)
    await userEvent.type(field, "Mein Entwurf")
    await userEvent.click(canvas.getByRole("button", { name: "Leave editor" }))
    await userEvent.click(
      canvas.getByRole("button", { name: "Return to editor" }),
    )
    await expect(
      canvas.getByRole("textbox", { name: "Translation in German" }),
    ).toHaveValue("Mein Entwurf")
  },
}

export const LanguageQueue: Story = {
  render: () => (
    <UserContext
      value={{
        loading: false,
        info: {
          default_account: { login: "translator", provider: "github" },
          auths: {},
          invite_code: "",
          accepted_publisher_agreement_at: null,
          permissions: [Permission["manage-apps"]],
        },
      }}
    >
      <AppTranslations language="de" />
    </UserContext>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get("*/metadata-translations/queue", () =>
          HttpResponse.json({
            apps: [
              { app_id: "net.filebot.FileBot", name: "FileBot" },
              { app_id: "org.example.Reader", name: "Reader" },
            ],
            attention: [],
            indexing: false,
          }),
        ),
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json({
            ...meta.args.source,
            units: meta.args.source.units.slice(0, 2).reverse(),
          }),
        ),
        http.post("*/metadata-translations/:appId", async ({ request }) => {
          const { changes } = (await request.json()) as {
            changes: Record<string, string>
          }
          return HttpResponse.json({
            url: null,
            state: "queued",
            units: meta.args.source.units
              .slice(0, 2)
              .reverse()
              .map((u) => ({
                ...u,
                translation: changes[u.id] ?? u.translation,
              })),
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "FileBot" }),
    ).toBeVisible()
    const field = await canvas.findByRole("textbox", {
      name: "Translation in German",
    })
    await userEvent.type(field, "Mediendateien umbenennen")
    await userEvent.click(
      canvas.getByRole("button", { name: "Save and open next app" }),
    )
    await expect(
      await canvas.findByRole("heading", { name: "Reader" }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Skip app" }))
    await userEvent.click(
      await canvas.findByRole("button", { name: "Revisit skipped apps (1)" }),
    )
    await expect(
      await canvas.findByRole("heading", { name: "Reader" }),
    ).toBeVisible()
  },
}

export const SharedEditConflict: Story = {
  render: Editor.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Translation language" }),
      "de",
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Load translations" }),
    )
    const draft = await canvas.findByRole("textbox", {
      name: "Translation in German",
    })
    await userEvent.type(draft, "Mein Entwurf")
    await userEvent.click(canvas.getByRole("button", { name: "Save and next" }))
    await expect(await canvas.findByText("Gemeinsam umbenennen")).toBeVisible()
    await expect(draft).toHaveValue("Mein Entwurf")
    await userEvent.click(
      canvas.getByRole("button", { name: "Keep editing my draft" }),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Save and next" }))
    await expect(await canvas.findByText("Translation saved.")).toBeVisible()
  },
  parameters: {
    msw: {
      handlers: [
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json(meta.args.source),
        ),
        http.post(
          "*/metadata-translations/:appId",
          () =>
            HttpResponse.json(
              {
                detail: {
                  code: "text_conflict",
                  unit: {
                    ...meta.args.source.units[0],
                    translation: "Gemeinsam umbenennen",
                    version: "other-save",
                    last_editor_id: 43,
                  },
                },
              },
              { status: 409 },
            ),
          { once: true },
        ),
        ...meta.parameters.msw.handlers,
      ],
    },
  },
}

export const Queued: Story = {
  render: Editor.render,
  parameters: {
    msw: {
      handlers: [
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json({ ...meta.args.source, batch_state: "queued" }),
        ),
        ...meta.parameters.msw.handlers,
      ],
    },
  },
}

export const PublicationFailed: Story = {
  render: Editor.render,
  parameters: {
    msw: {
      handlers: [
        http.get(
          "*/metadata-translations/:appId",
          () =>
            HttpResponse.json({
              ...meta.args.source,
              batch_state: "failed",
              batch_error: "source_changed",
              can_submit: false,
            }),
          { once: true },
        ),
        http.post("*/metadata-translations/:appId/rebase", () =>
          HttpResponse.json(null),
        ),
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json({
            ...meta.args.source,
            revision: "b".repeat(40),
            previous_translations: [
              {
                ...meta.args.source.units[0],
                translation: "Mediendateien perfekt umbenennen",
              },
            ],
          }),
        ),
        ...meta.parameters.msw.handlers,
      ],
    },
  },
}

export const Recovered: Story = {
  args: {
    source: {
      ...meta.args.source,
      previous_translations: [
        {
          ...meta.args.source.units[0],
          translation: "Mediendateien perfekt umbenennen",
        },
      ],
    },
  },
}

export const PullRequestClosed: Story = {
  render: Editor.render,
  parameters: {
    msw: {
      handlers: [
        http.get(
          "*/metadata-translations/:appId",
          () =>
            HttpResponse.json({
              ...meta.args.source,
              batch_state: "failed",
              batch_error: "pull_request_closed",
              pull_request_url:
                "https://github.com/flathub/net.filebot.FileBot/pull/1",
            }),
          { once: true },
        ),
        http.post("*/metadata-translations/:appId/rebase", () =>
          HttpResponse.json(null),
        ),
        http.get("*/metadata-translations/:appId", () =>
          HttpResponse.json({ ...meta.args.source, batch_state: "queued" }),
        ),
        ...meta.parameters.msw.handlers,
      ],
    },
  },
}
