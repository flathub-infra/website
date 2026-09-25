import {
  getPopularLastMonthCollectionPopularGet,
  getAppOfTheDayAppPicksAppOfTheDayDateGet,
  getAppOfTheWeekAppPicksAppsOfTheWeekDateGet,
  getAppstreamAppstreamAppIdGet,
  getCategoryCollectionCategoryCategoryGet,
  getSubcategoryCollectionCategoryCategorySubcategoriesGet,
  getRecentlyUpdatedCollectionRecentlyUpdatedGet,
  getRecentlyAddedCollectionRecentlyAddedGet,
  getTrendingLastTwoWeeksCollectionTrendingGet,
  getMobileCollectionMobileGet,
  AppSchemasSortBy,
  DesktopAppstream,
} from "../../../src/codegen"
import { Metadata } from "next"
import { APPS_IN_PREVIEW_COUNT } from "../../../src/env"
import {
  MainCategory,
  MeilisearchResponseAppsIndex,
} from "../../../src/codegen"
import { formatISO } from "date-fns"
import HomeClient from "../home-client"
import { getTranslations } from "next-intl/server"
import { staticLocales } from "../../../src/i18n/static-locales"
import { gameCategoryFilter } from "../../../src/types/Category"
import cardImage from "../../../public/img/card.webp"
import { getHomepageCuratedAppSelections } from "../../../src/asyncs/curated-app-selections"
import { getUtcDateString } from "../../../src/utils/date"

const categoryOrder: MainCategory[] = [
  MainCategory.office,
  MainCategory.graphics,
  MainCategory.audiovideo,
  MainCategory.education,
  MainCategory.game,
  MainCategory.network,
  MainCategory.development,
  MainCategory.science,
  MainCategory.healthfitness,
  MainCategory.system,
  MainCategory.utility,
]

const categoryRank = (category: MainCategory) => {
  const index = categoryOrder.indexOf(category)
  return index === -1 ? categoryOrder.length : index
}

function emptyCollection(): MeilisearchResponseAppsIndex {
  return {
    hits: [],
    query: "",
    processingTimeMs: 0,
    hitsPerPage: 0,
    page: 1,
    totalPages: 0,
    totalHits: 0,
  }
}

export async function generateStaticParams() {
  const params = staticLocales.map((locale) => ({
    locale: locale,
  }))

  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org"

  return {
    title: t("flathub-apps-for-linux"),
    description: t("flathub-description"),
    openGraph: {
      title: t("flathub-apps-for-linux"),
      description: t("flathub-description"),
      url: `${siteUrl}/${locale}`,
      images: [
        {
          url: cardImage.src,
          width: cardImage.width,
          height: cardImage.height,
          alt: t("flathub-apps-for-linux"),
        },
      ],
    },
    twitter: {
      title: t("flathub-apps-for-linux"),
      description: t("flathub-description"),
      images: [cardImage.src],
    },
    alternates: {
      canonical: `${siteUrl}/${locale}`,
    },
  }
}

async function getCollections(locale: string) {
  const results = await Promise.all([
    getRecentlyUpdatedCollectionRecentlyUpdatedGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getPopularLastMonthCollectionPopularGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getRecentlyAddedCollectionRecentlyAddedGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getTrendingLastTwoWeeksCollectionTrendingGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getMobileCollectionMobileGet({ page: 1, per_page: 6, locale })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
  ])

  return results as [
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
  ]
}

async function getCategoryData(locale: string) {
  const categoryPromises = Object.keys(MainCategory)
    .filter((category) => category !== "game")
    .map(async (category: MainCategory) => {
      try {
        const appsResult = await getCategoryCollectionCategoryCategoryGet(
          category,
          {
            page: 1,
            per_page: 6,
            locale,
            sort_by: AppSchemasSortBy.trending,
          },
        )

        return {
          category,
          apps: appsResult.data,
        }
      } catch {
        return { category, apps: emptyCollection() }
      }
    })

  const topAppsByCategory = await Promise.all(categoryPromises)

  // Sort categories according to predefined order
  return topAppsByCategory
    .filter((c) => (c.apps.hits?.length ?? 0) > 0)
    .sort((a, b) => {
      return categoryRank(a.category) - categoryRank(b.category)
    })
}

async function getHeroBanner(dateString: string, locale: string) {
  const [heroBannerAppsResult, appOfTheDayResult] = await Promise.allSettled([
    getAppOfTheWeekAppPicksAppsOfTheWeekDateGet(dateString),
    getAppOfTheDayAppPicksAppOfTheDayDateGet(dateString),
  ])

  const heroBannerApps =
    heroBannerAppsResult.status === "fulfilled"
      ? heroBannerAppsResult.value.data
      : { apps: [] }
  const appOfTheDay =
    appOfTheDayResult.status === "fulfilled"
      ? appOfTheDayResult.value.data
      : null

  const allAppIds = [
    ...heroBannerApps.apps.map((app) => app.app_id),
    ...(appOfTheDay ? [appOfTheDay.app_id] : []),
  ]

  const allAppstreamResults = await Promise.allSettled(
    allAppIds.map((appId) =>
      getAppstreamAppstreamAppIdGet(appId, { locale }).then((r) => r.data),
    ),
  )
  const allAppstreams = allAppstreamResults.flatMap((result) =>
    result.status === "fulfilled" && "description" in result.value
      ? [result.value as DesktopAppstream]
      : [],
  )

  const appstreamMap = new Map(
    allAppstreams.map((appstream) => [appstream.id, appstream]),
  )

  const heroBannerData = heroBannerApps.apps.flatMap((app) => {
    const appstream = appstreamMap.get(app.app_id)
    return appstream ? [{ app, appstream }] : []
  })

  return {
    heroBannerData,
    appOfTheDayAppstream: appOfTheDay
      ? appstreamMap.get(appOfTheDay.app_id)
      : undefined,
  }
}

async function getGameData(locale: string) {
  const results = await Promise.all([
    getCategoryCollectionCategoryCategoryGet(MainCategory.game, {
      page: 1,
      per_page: 12,
      locale,
      exclude_subcategories: gameCategoryFilter,
      sort_by: AppSchemasSortBy.trending,
    })
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["emulator"],
        sort_by: AppSchemasSortBy.trending,
      },
    )
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["packageManager", "launcherStore"],
        sort_by: AppSchemasSortBy.trending,
      },
    )
      .then((r) => r.data)
      .catch(() => emptyCollection()),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["utility", "network", "gameTool"],
        sort_by: AppSchemasSortBy.trending,
      },
    )
      .then((r) => r.data)
      .catch(() => emptyCollection()),
  ])

  return results as [
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
  ]
}

export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const currentDate = formatISO(new Date(), { representation: "date" })
  const currentUtcDate = getUtcDateString()

  // Fetch all data sequentially to reduce backend load during build
  const collections = await getCollections(locale)
  const [recentlyUpdated, popular, recentlyAdded, trending, mobile] =
    collections

  const topAppsByCategory = await getCategoryData(locale)

  const heroBanner = await getHeroBanner(currentDate, locale)
  const { heroBannerData, appOfTheDayAppstream } = heroBanner

  const gameData = await getGameData(locale)
  const [games, emulators, gameLaunchers, gameTools] = gameData

  const curatedAppSelections = await getHomepageCuratedAppSelections(
    currentUtcDate,
    locale,
  )

  return (
    <HomeClient
      recentlyUpdated={recentlyUpdated}
      recentlyAdded={recentlyAdded}
      trending={trending}
      popular={popular}
      topAppsByCategory={topAppsByCategory}
      heroBannerData={heroBannerData}
      appOfTheDayAppstream={appOfTheDayAppstream}
      mobile={mobile}
      games={games}
      emulators={emulators}
      gameLaunchers={gameLaunchers}
      gameTools={gameTools}
      curatedAppSelections={curatedAppSelections}
    />
  )
}
