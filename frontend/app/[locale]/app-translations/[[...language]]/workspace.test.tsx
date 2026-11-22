// @vitest-environment jsdom
import { act, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { expect, it, onTestFinished, vi } from "vitest"
import AppTranslations from "./workspace"
import MetadataTranslationEditor from "src/components/application/MetadataTranslationEditor"
import { openTranslationDrafts } from "src/components/application/translationDrafts"

const save = vi.hoisted(() => vi.fn())
const unit = {
  id: "summary",
  field: "summary",
  context: "",
  source: "Example",
  translation: "",
  version: "v1",
}
vi.mock("src/codegen/metadata-translations/metadata-translations", () => ({
  getTranslationQueueMetadataTranslationsQueueGet: async () => ({
    data: {
      apps: ["Alpha", "Beta", "Gamma"].map((name) => ({
        app_id: `org.example.${name}`,
        name,
      })),
      attention: [],
    },
  }),
  getTranslationSourceMetadataTranslationsAppIdGet: async (
    _app: string,
    { locale }: { locale: string },
  ) => ({
    data: {
      revision: "a".repeat(40),
      path: "app.xml",
      metadata_license: "CC0",
      locale,
      can_submit: true,
      units: [unit],
    },
  }),
  saveListingTranslationsMetadataTranslationsAppIdPost: save,
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(location.search),
}))
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("src/i18n/navigation", () => ({
  useRouter: () => ({}),
  usePathname: () => location.pathname,
  Link: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({
    info: {
      permissions: ["manage-apps"],
      default_account: { provider: "github", login: "translator" },
    },
  }),
}))

it("shares the language loaded in the standalone editor", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  const client = new QueryClient()
  const original = location.href
  const render = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MetadataTranslationEditor
            appId="org.example.Reader"
            initialLanguage="de"
          />
        </QueryClientProvider>,
      ),
    )
  try {
    history.replaceState(null, "", "?language=de")
    await render()
    const select = host.querySelector("select")!
    await act(async () => {
      select.value = "fr"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(new URL(location.href).searchParams.get("language")).toBe("de")
    await act(async () => host.querySelector("form")!.requestSubmit())
    expect(new URL(location.href).searchParams.get("language")).toBe("fr")
    await act(async () => root.render(null))
    await render()
    expect(host.querySelector("select")?.value).toBe("fr")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    client.clear()
    history.replaceState(null, "", original)
    vi.unstubAllGlobals()
  }
})

async function openBetaWhileAlphaIsSaving() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  notifyManager.setNotifyFunction((notify) => {
    act(notify)
  })
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  const client = new QueryClient()
  const response = Promise.withResolvers<unknown>()
  history.replaceState(null, "", location.pathname)
  localStorage.clear()
  save.mockClear()
  save.mockReturnValue(response.promise)
  const render = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AppTranslations language="de" />
        </QueryClientProvider>,
      ),
    )
  const field = () => host.querySelector("textarea")!
  const edit = async (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(field(), value)
      field().dispatchEvent(new Event("input", { bubbles: true }))
    })
  const click = async (text: string) =>
    act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent === text)!
        .click(),
    )
  const waitForEditor = async (name: string) =>
    vi.waitFor(async () => {
      await act(async () => {})
      expect(host.querySelector("h2")?.textContent).toBe(name)
      expect(field()).toBeTruthy()
    })
  onTestFinished(async () => {
    await act(async () => root.unmount())
    host.remove()
    client.clear()
    notifyManager.setNotifyFunction((notify) => notify())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  await render()
  await waitForEditor("Alpha")
  await edit("Alt")
  await click("Save and open next app")
  expect(save).toHaveBeenCalledTimes(1)
  history.pushState(null, "", "?app=org.example.Beta")
  await render()
  await waitForEditor("Beta")
  const sourceKey = [
    "listing-translations",
    "org.example.Alpha",
    "de",
    "github:translator",
  ]
  const finishSave = () =>
    act(async () =>
      response.resolve({
        data: {
          units: [{ ...unit, translation: "Alt", version: "v2" }],
          state: "queued",
        },
      }),
    )
  return {
    host,
    client,
    sourceKey,
    finishSave,
    click,
    waitForEditor,
    edit,
    field,
  }
}

it("removes a completed app without advancing the visible editor", async () => {
  const { host, finishSave, click, waitForEditor } =
    await openBetaWhileAlphaIsSaving()
  await finishSave()
  expect(host.querySelector("h2")?.textContent).toBe("Beta")
  await click("Skip app")
  await waitForEditor("Gamma")
})

it("does not merge a late save into a newer source revision", async () => {
  const { client, sourceKey, finishSave } = await openBetaWhileAlphaIsSaving()
  const newer = { ...unit, source: "Revised example", version: "r2" }
  client.setQueryData(sourceKey, {
    data: { revision: "b".repeat(40), units: [newer] },
  })
  await finishSave()
  expect(client.getQueryData(sourceKey)).toMatchObject({
    data: { units: [newer] },
  })
})

it.each(["Neuer Entwurf", ""])(
  "preserves the later edit %j across a delayed save and reload",
  async (laterEdit) => {
    const {
      host,
      client,
      sourceKey,
      finishSave,
      click,
      waitForEditor,
      edit,
      field,
    } = await openBetaWhileAlphaIsSaving()
    await click("Skip app")
    await waitForEditor("Alpha")
    await edit("Neuer Entwurf")
    if (!laterEdit) {
      await edit("")
    }
    const before = client.getQueryData(sourceKey)
    const stale = Promise.withResolvers<unknown>()
    const reload = client
      .fetchQuery({ queryKey: sourceKey, queryFn: () => stale.promise })
      .catch(() => undefined)
    await finishSave()
    expect(new URL(location.href).searchParams.get("app")).toBe(
      "org.example.Alpha",
    )
    await act(async () => {
      stale.resolve(before)
      await reload
    })
    expect(field().value).toBe(laterEdit)
    const key = JSON.stringify(["github:translator", "org.example.Alpha", "de"])
    expect(openTranslationDrafts(key).get(unit)?.text).toBe(laterEdit)
    expect(client.getQueryData(sourceKey)).toMatchObject({
      data: { units: [{ translation: "Alt" }] },
    })
    await vi.waitFor(() =>
      expect(
        Array.from(host.querySelectorAll("button")).find(
          (b) => b.textContent === "Skip app",
        )?.disabled,
      ).toBe(false),
    )
    save.mockResolvedValueOnce({
      data: {
        units: [{ ...unit, translation: laterEdit, version: "v3" }],
        state: "queued",
      },
    })
    await click("Save and open next app")
    expect(save.mock.lastCall?.[1]).toMatchObject({
      changes: { summary: laterEdit },
      versions: { summary: "v2" },
    })
    if (laterEdit) {
      await waitForEditor("Gamma")
      expect(host.querySelector("summary")?.textContent).toBe(
        "Choose an app (2)",
      )
    } else {
      await vi.waitFor(() => expect(field().value).toBe(""))
      expect(host.querySelector("h2")?.textContent).toBe("Alpha")
    }
  },
)
