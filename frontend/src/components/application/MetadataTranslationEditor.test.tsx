// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { QueryClient } from "@tanstack/react-query"
import type { TranslationUnit } from "src/codegen/model/translationUnit"
import { describe, expect, it, vi } from "vitest"
import Links from "./Links"
import {
  openTranslationDrafts,
  discardTranslationDrafts,
} from "./translationDrafts"
import AppTranslations from "../../../app/[locale]/app-translations/[[...language]]/workspace"
import MetadataTranslationEditor, {
  TranslationForm,
} from "./MetadataTranslationEditor"
import { metadataTranslationText } from "./MetadataTranslationEditor.messages"

const user = vi.hoisted(() => ({
  loading: false,
  info: { permissions: [] as string[] },
  signedOut: false,
}))
const query = vi.hoisted(() =>
  vi.fn<(options: { queryKey: string[] }) => object>(() => ({})),
)
const getQueryClient = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const mutating = vi.hoisted(() => vi.fn(() => 0))
const mutation = vi.hoisted(() =>
  vi.fn<
    (options: {
      onSuccess?: (response: { data: TranslationUnit[] }) => unknown
    }) => object
  >(() => ({})),
)

vi.mock("src/context/user-info", () => ({
  useUserContext: () =>
    user.signedOut ? { loading: false, info: null } : user,
}))
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: query,
  useQueryClient: getQueryClient,
  useIsMutating: mutating,
  useMutation: mutation,
}))
vi.mock("@mitresthen/matomo-tracker-react", () => ({
  useMatomo: () => ({ trackEvent: vi.fn() }),
}))
vi.mock("src/i18n/navigation", () => ({
  getPathname: ({ href }: { href: string }) => href,
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ replace }),
  usePathname: () => "/apps/org.example.App/translate",
}))

function withMessages(children: React.ReactNode) {
  return (
    <NextIntlClientProvider
      locale="de"
      timeZone="UTC"
      messages={{
        whoops: "Whoops",
        "unauthorized-to-view": "Access denied",
        "retry-or-go-home": "<link>Go home</link>",
        "report-an-issue": "Report an issue",
        manifest: "Manifest",
        "open-in-new-tab": "Open in new tab",
      }}
    >
      {children}
    </NextIntlClientProvider>
  )
}

function render(children: React.ReactNode) {
  return renderToStaticMarkup(withMessages(children))
}

async function mounted(
  children: React.ReactNode,
  check: (host: HTMLElement) => Promise<void>,
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  const root = createRoot(host)
  try {
    await act(async () => root.render(withMessages(children)))
    await check(host)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
}

describe("admin-only listing translations", () => {
  it("restores a navigation draft without attaching it to a changed source", () => {
    const unit = {
      id: "summary",
      field: "summary",
      context: "",
      source: "Read",
      translation: "",
      version: "v1",
    }
    const source = {
      revision: "a".repeat(40),
      path: "reader.xml",
      source_url: "",
      metadata_license: "CC0",
      locale: "de",
      can_submit: true,
      units: [unit],
    }
    const key = "reader:draft"
    openTranslationDrafts(key).edit(unit, "Lesen")
    try {
      expect(
        render(
          <TranslationForm
            appId="org.example.Reader"
            draftKey={key}
            source={source}
          />,
        ),
      ).toMatch(/<textarea[^>]*>Lesen<\/textarea>/)
      const changed = render(
        <TranslationForm
          appId="org.example.Reader"
          draftKey={key}
          source={{
            ...source,
            units: [{ ...unit, source: "Write", version: "v2" }],
          }}
        />,
      )
      expect(changed).toContain("Draft for a changed text")
      expect(changed).toContain("Lesen")
      expect(changed).not.toMatch(/<textarea[^>]*>Lesen<\/textarea>/)
    } finally {
      discardTranslationDrafts(key)
    }
  })
  it("disables loading translations while a dismissal is in flight", () => {
    user.info.permissions = ["manage-apps"]
    mutating.mockReturnValueOnce(1)
    expect(
      render(<MetadataTranslationEditor appId="org.example.App" />),
    ).toMatch(
      /<button\b[^>]*\bdisabled=""[^>]*>(?:(?!<\/button>).)*Load translations/,
    )
  })

  it("cancels a stale reload before updating recovery history", async () => {
    const client = new QueryClient()
    const key = ["listing-translations", "org.example.App", "", ""]
    const item = {
      id: "summary",
      field: "summary",
      context: "",
      source: "Old",
      translation: "Saved",
    }
    const previous = {
      data: {
        revision: "a".repeat(40),
        path: "metadata.xml",
        source_url: "",
        metadata_license: "CC0-1.0",
        locale: "de",
        can_submit: true,
        units: [],
        previous_translations: [item],
      },
    }
    user.info.permissions = ["manage-apps"]
    getQueryClient.mockReturnValueOnce(client)
    query.mockReturnValueOnce({ data: previous, dataUpdatedAt: 100 })
    client.setQueryData(key, previous, { updatedAt: 100 })
    let finishReload!: (value: typeof previous) => void
    const reload = client
      .fetchQuery({
        queryKey: key,
        queryFn: () =>
          new Promise<typeof previous>((resolve) => {
            finishReload = resolve
          }),
      })
      .catch(() => undefined)
    render(<MetadataTranslationEditor appId="org.example.App" />)
    const onSuccess = mutation.mock.lastCall?.[0].onSuccess
    expect(onSuccess).toBeDefined()
    await onSuccess?.({ data: [] })
    finishReload(previous)
    await reload
    expect(client.getQueryData(key)).toEqual({
      data: { ...previous.data, previous_translations: [] },
    })
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(100)
  })
  it.each([
    ["source_changed", "Use current source"],
    ["pull_request_closed", "Prepare a new pull request"],
    ["source_unavailable", "You can still copy your saved translations."],
  ])("shows recovery for %s and retained translations", (error, action) => {
    const html = render(
      <TranslationForm
        appId="org.example.App"
        onRecovered={async () => {}}
        onDismissed={async () => {}}
        isReloading
        source={{
          revision: "a".repeat(40),
          path: "metadata.xml",
          source_url: "https://github.com/flathub/org.example.App",
          metadata_license: "CC0-1.0",
          locale: "de",
          can_submit: false,
          batch_error: error,
          units: [],
          previous_translations: [
            {
              id: "/component/summary",
              field: "summary",
              context: "",
              source: "Previous source",
              translation: "Gespeicherter Text",
            },
          ],
        }}
      />,
    )
    expect(html).toContain(action)
    expect(html).toContain("Previous source")
    expect(html).toContain("Gespeicherter Text")
    expect(html).toContain("Dismiss saved translation")
    expect(html).toMatch(
      /<button\b[^>]*\bdisabled=""[^>]*>Dismiss saved translation<\/button>/,
    )
  })
  it.each([[], ["moderation"], ["view-users"]])(
    "hides the editor and link for permissions %j",
    (...permissions: string[]) => {
      user.info.permissions = permissions
      const html = render(<MetadataTranslationEditor appId="org.example.App" />)
      expect(html).toContain("Access denied")
      expect(html).not.toContain("translation-language")
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false }),
      )
      expect(
        render(<Links app={{ id: "org.example.App", urls: {} }} />),
      ).not.toContain("/apps/org.example.App/translate")
    },
  )

  it("links to Weblate without granting access to the queue", () => {
    user.info.permissions = ["modify-users"]
    query.mockClear()
    const html = render(<AppTranslations language="de" />)
    expect(html).toContain("https://hosted.weblate.org/engage/flathub/")
    expect(html).not.toContain("Change language")
    expect(query).not.toHaveBeenCalled()
  })
  it("includes the shared language in the login return URL", async () => {
    user.signedOut = true
    try {
      await mounted(
        <MetadataTranslationEditor
          appId="org.example.App"
          initialLanguage="de"
        />,
        async () => {
          expect(replace).toHaveBeenCalledWith(
            `/login?returnTo=${encodeURIComponent("/apps/org.example.App/translate?language=de")}`,
          )
        },
      )
    } finally {
      user.signedOut = false
    }
  })

  it("refreshes finished apps without revisiting skipped apps", async () => {
    user.info.permissions = ["manage-apps"]
    const refetch = vi.fn(async () => ({ isSuccess: true }))
    const apps = ["Skipped", "Finished"].map((name) => ({
      app_id: `org.example.${name}`,
      name,
    }))
    query.mockImplementation(({ queryKey }) =>
      queryKey[0] === "app-translation-queue"
        ? { data: { apps, attention: [] }, refetch }
        : { data: { data: { units: [] } } },
    )
    try {
      await mounted(<AppTranslations language="de" />, async (host) => {
        const click = async (name: string) => {
          const button = Array.from(host.querySelectorAll("button")).find(
            (el) => el.textContent === name,
          )
          expect(button).toBeDefined()
          await act(async () => button!.click())
        }
        await click("Skip app")
        await click("Continue to next app")
        await click("Refresh queue")
        expect(refetch).toHaveBeenCalledOnce()
        expect(host.querySelector("h2")?.textContent).toBe("Finished")
      })
    } finally {
      query.mockImplementation(() => ({}))
      localStorage.clear()
    }
  })
  it("offers a refresh when only listings needing attention remain", () => {
    user.info.permissions = ["manage-apps"]
    query.mockReturnValueOnce({
      data: {
        apps: [],
        indexing: false,
        attention: [{ app_id: "org.example.Reader", name: "Reader" }],
      },
    })
    const html = render(<AppTranslations language="de" />)
    expect(html).toContain("No more apps in this queue.")
    expect(html).toContain("Refresh queue")
    expect(html).toContain("Needs attention (1)")
  })

  it("offers admins the language picker away from the app detail page", () => {
    user.info.permissions = ["manage-apps"]
    expect(render(<AppTranslations />)).toContain("queue-language")
    expect(
      render(<MetadataTranslationEditor appId="org.example.App" />),
    ).toContain("Translate this listing")
    expect(
      render(<Links app={{ id: "org.example.App", urls: {} }} />),
    ).not.toContain("/apps/org.example.App/translate")
    expect(
      metadataTranslationText("translated-count", { count: 1, total: 3 }),
    ).toBe("1 of 3 translated")
    expect(metadataTranslationText("fields.summary")).toBe("Summary")
  })
})
