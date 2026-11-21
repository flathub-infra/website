import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import type { DesktopAppstream } from "src/codegen"
import { QualityModeration } from "./QualityModeration"

const mocks = vi.hoisted(() => ({
  info: { permissions: [] as string[], dev_flatpaks: [] as string[] },
  status: vi.fn(() => ({ data: undefined })),
  moderation: vi.fn(() => ({
    isSuccess: true,
    data: { data: { requests_count: 0 } },
  })),
}))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({ info: mocks.info }),
}))
vi.mock("src/i18n/navigation", () => ({ Link: "a" }))
vi.mock("./QualityModerationSlideOver", () => ({
  QualityModerationSlideOver: ({ mode }: { mode: string }) => (
    <aside data-mode={mode}>quality panel</aside>
  ),
}))
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }))
vi.mock("src/codegen", () => ({
  Permission: {
    "manage-apps": "manage-apps",
    "quality-moderation": "quality-moderation",
    moderation: "moderation",
  },
  useGetQualityModerationStatusForAppQualityModerationAppIdStatusGet:
    mocks.status,
  useGetModerationAppModerationAppsAppIdGet: mocks.moderation,
  useRequestReviewForAppQualityModerationAppIdRequestReviewPost: () => ({}),
}))

it.each([0, 1])(
  "shows read-only quality details to moderators with %i pending requests",
  (count) => {
    const id = "org.example.App"
    mocks.info.permissions = ["moderation"]
    mocks.info.dev_flatpaks = []
    mocks.moderation.mockReturnValueOnce({
      isSuccess: true,
      data: { data: { requests_count: count } },
    })
    const html = renderToStaticMarkup(
      <QualityModeration
        app={{ id } as DesktopAppstream}
        isQualityModalOpen={false}
        setIsQualityModalOpen={() => {}}
      />,
    )
    expect(html).toContain("quality-guideline.details")
    expect(html).toContain('data-mode="readOnly"')
    expect(html).not.toContain("quality-guideline.request-review")
    expect(html.includes(`/admin/moderation/${id}`)).toBe(count > 0)
    expect(mocks.status).toHaveBeenLastCalledWith(
      id,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false }),
      }),
    )
  },
)

it.each([
  { permission: "manage-apps", assigned: false, quality: false, manage: true },
  { permission: "", assigned: true, quality: true, manage: true },
  {
    permission: "quality-moderation",
    assigned: false,
    quality: true,
    manage: false,
  },
])(
  "separates quality access from app management: $permission, assigned=$assigned",
  ({ permission, assigned, quality, manage }) => {
    const id = "org.example.App"
    mocks.info.permissions = [permission]
    mocks.info.dev_flatpaks = assigned ? [id] : []
    const html = renderToStaticMarkup(
      <QualityModeration
        app={{ id } as DesktopAppstream}
        isQualityModalOpen={false}
        setIsQualityModalOpen={() => {}}
      />,
    )
    expect(mocks.status).toHaveBeenLastCalledWith(
      id,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: quality }),
      }),
    )
    expect(html.includes("quality panel")).toBe(quality)
    expect(html.includes(`/apps/manage/${id}`)).toBe(manage)
    expect(html.includes("quality-guideline.request-review")).toBe(assigned)
  },
)
