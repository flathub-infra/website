import { getAppstreamAppstreamAppIdGet } from "../codegen/app/app"
import { getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet } from "../codegen/app-picks/app-picks"
import type {
  CuratedAppSelection,
  CuratedAppSelectionApp,
  GetAppstreamAppstreamAppIdGet200,
} from "../codegen/model"
import {
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
  type HomepageCuratedApp,
  type HomepageCuratedAppSelection,
  type HomepageCuratedAppSelectionSlot,
  type HomepageCuratedAppSelectionsBySlot,
} from "../types/CuratedAppSelection"

const homepageSelectionSlots = new Set<string>(
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
)

function isHomepageCuratedAppSelectionSlot(
  slot: string,
): slot is HomepageCuratedAppSelectionSlot {
  return homepageSelectionSlots.has(slot)
}

function mapAppstreamToListItem(
  appstream: GetAppstreamAppstreamAppIdGet200,
  isFullscreen: boolean,
  includeHeroData: boolean,
): HomepageCuratedApp | null {
  if (!("summary" in appstream) || typeof appstream.summary !== "string") {
    return null
  }

  return {
    id: appstream.id,
    name: appstream.name,
    summary: appstream.summary,
    isFullscreen,
    icon: "icon" in appstream ? appstream.icon : undefined,
    metadata: "metadata" in appstream ? appstream.metadata : undefined,
    bundle: "bundle" in appstream ? appstream.bundle : undefined,
    is_eol: "is_eol" in appstream ? appstream.is_eol : undefined,
    branding:
      includeHeroData && "branding" in appstream
        ? appstream.branding
        : undefined,
    screenshots:
      includeHeroData && "screenshots" in appstream
        ? appstream.screenshots
        : undefined,
  }
}

async function getSelectionApps(
  apps: CuratedAppSelectionApp[],
  locale: string,
  includeHeroData: boolean,
): Promise<HomepageCuratedApp[]> {
  const sortedApps = apps.slice().sort((a, b) => a.position - b.position)
  const appstreamResults = await Promise.allSettled(
    sortedApps.map((app) =>
      getAppstreamAppstreamAppIdGet(app.app_id, { locale }).then(
        (response) => response.data,
      ),
    ),
  )

  return appstreamResults
    .map((result, index) =>
      result.status === "fulfilled"
        ? mapAppstreamToListItem(
            result.value,
            sortedApps[index].isFullscreen,
            includeHeroData,
          )
        : null,
    )
    .filter((app): app is HomepageCuratedApp => app !== null)
}

export async function getHomepageCuratedAppSelections(
  date: string,
  locale: string,
): Promise<HomepageCuratedAppSelectionsBySlot> {
  try {
    const response =
      await getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet(date)

    const selections = await Promise.all(
      response.data.selections.map(
        async (
          selection: CuratedAppSelection,
        ): Promise<HomepageCuratedAppSelection | null> => {
          if (!isHomepageCuratedAppSelectionSlot(selection.slot)) {
            return null
          }

          const apps = await getSelectionApps(
            selection.apps,
            locale,
            selection.layout === "carousel",
          )
          if (apps.length === 0) {
            return null
          }

          return {
            id: selection.id,
            themeKey: selection.theme_key,
            slot: selection.slot,
            layout: selection.layout,
            apps,
          }
        },
      ),
    )

    return selections.reduce<HomepageCuratedAppSelectionsBySlot>(
      (selectionsBySlot, selection) => {
        if (selection && !selectionsBySlot[selection.slot]) {
          selectionsBySlot[selection.slot] = selection
        }

        return selectionsBySlot
      },
      {},
    )
  } catch {
    return {}
  }
}
