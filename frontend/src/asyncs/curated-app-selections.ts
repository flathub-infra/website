import { getAppstreamAppstreamAppIdGet } from "../codegen/app/app"
import { getCuratedAppSelectionsAppPicksCuratedAppSelectionsDateGet } from "../codegen/app-picks/app-picks"
import type {
  CuratedAppSelection,
  CuratedAppSelectionApp,
  GetAppstreamAppstreamAppIdGet200,
} from "../codegen/model"
import type { AppstreamListItem } from "../types/Appstream"
import {
  HOMEPAGE_CURATED_APP_SELECTION_SLOTS,
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
): AppstreamListItem | null {
  if (!("summary" in appstream) || typeof appstream.summary !== "string") {
    return null
  }

  return {
    id: appstream.id,
    name: appstream.name,
    summary: appstream.summary,
    icon: "icon" in appstream ? appstream.icon : undefined,
    metadata: "metadata" in appstream ? appstream.metadata : undefined,
    bundle: "bundle" in appstream ? appstream.bundle : undefined,
    is_eol: "is_eol" in appstream ? appstream.is_eol : undefined,
  }
}

async function getSelectionApps(
  apps: CuratedAppSelectionApp[],
  locale: string,
): Promise<AppstreamListItem[]> {
  const appstreamResults = await Promise.allSettled(
    apps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((app) =>
        getAppstreamAppstreamAppIdGet(app.app_id, { locale }).then(
          (response) => response.data,
        ),
      ),
  )

  return appstreamResults
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<GetAppstreamAppstreamAppIdGet200> =>
        result.status === "fulfilled",
    )
    .map((result) => mapAppstreamToListItem(result.value))
    .filter((app): app is AppstreamListItem => app !== null)
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

          const apps = await getSelectionApps(selection.apps, locale)
          if (apps.length === 0) {
            return null
          }

          return {
            id: selection.id,
            themeKey: selection.theme_key,
            slot: selection.slot,
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
