import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import fetchCollection, {
  fetchAppOfTheDay,
  fetchAppsOfTheWeek,
  fetchAppstream,
  fetchCategory,
} from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import { categoryToName } from "src/types/Category"
import ApplicationSection from "src/components/application/ApplicationSection"
import { HeroBanner } from "src/components/application/HeroBanner"
import { DesktopAppstream } from "src/types/Appstream"
import clsx from "clsx"
import { AppOfTheDay } from "src/components/application/AppOfTheDay"
import { formatISO } from "date-fns"
import { useEffect, useState } from "react"
import MultiToggle from "src/components/MultiToggle"
import { useRouter } from "next/router"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MainCategory } from "src/codegen"

const categoryOrder = [
  MainCategory.office,
  MainCategory.graphics,
  MainCategory.audiovideo,
  MainCategory.education,
  MainCategory.game,
  MainCategory.network,
  MainCategory.development,
  MainCategory.science,
  MainCategory.system,
  MainCategory.utility,
]

const CategorySection = ({
  topAppsByCategory,
}: {
  topAppsByCategory: {
    category: MainCategory
    apps: MeilisearchResponse<AppsIndex>
  }[]
}) => {
  const { t } = useTranslation()

  return (
    <>
      {topAppsByCategory.map((sectionData) => (
        <ApplicationSection
          type="withCustomHeader"
          key={`categorySection${sectionData.category}`}
          href={`/apps/category/${encodeURIComponent(sectionData.category)}`}
          applications={sectionData.apps.hits.map((app) =>
            mapAppsIndexToAppstreamListItem(app),
          )}
          numberOfApps={6}
          customHeader={
            <>
              <header className="mb-3 flex max-w-full flex-row content-center justify-between">
                <h1 className="my-auto text-2xl font-bold">
                  {categoryToName(sectionData.category, t)}
                </h1>
              </header>
            </>
          }
          showMore={true}
          moreText={t(`more-${sectionData.category.toLowerCase()}`)}
        />
      ))}
    </>
  )
}

const TopSection = ({
  topApps,
}: {
  topApps: {
    name: string
    apps: MeilisearchResponse<AppsIndex>
    moreLink: string
  }[]
}) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [selectedName, setSelectedName] = useState<string>(
    router?.query?.category?.toString() || topApps[0].name,
  )

  const [selectedApps, setSelectedApps] = useState<{
    name: string
    apps: MeilisearchResponse<AppsIndex>
    moreLink: string
  }>(topApps.find((x) => x.name === selectedName) || topApps[0])

  useEffect(() => {
    if (router?.query?.category) {
      setSelectedName(router.query.category.toString())
    }
  }, [router?.query?.category])

  useEffect(() => {
    const foundApps = topApps.find(
      (sectionData) => sectionData.name === selectedName,
    )
    setSelectedApps(foundApps)
  }, [selectedName, topApps])

  return (
    <ApplicationSection
      type="withCustomHeader"
      key={`topSection${selectedApps.name}`}
      href={selectedApps.moreLink}
      applications={selectedApps.apps.hits.map((app) =>
        mapAppsIndexToAppstreamListItem(app),
      )}
      numberOfApps={APPS_IN_PREVIEW_COUNT}
      customHeader={
        <>
          <MultiToggle
            items={topApps.map((x) => ({
              id: x.name,
              content: (
                <div className="font-semibold truncate">{t(x.name)}</div>
              ),
              selected: x.name === selectedName,
              onClick: () => {
                const newQuery = { ...router.query }
                newQuery.category = x.name
                router.push({ query: newQuery }, undefined, {
                  scroll: false,
                })
              },
            }))}
            size={"lg"}
            variant="secondary"
          />
        </>
      }
      showMore={true}
      moreText={t(`more-${selectedApps.name}`)}
    />
  )
}

export default function Home({
  recentlyUpdated,
  recentlyAdded,
  trending,
  popular,
  topAppsByCategory,
  heroBannerData,
  appOfTheDayAppstream,
  mobile,
}: {
  recentlyUpdated: MeilisearchResponse<AppsIndex>
  recentlyAdded: MeilisearchResponse<AppsIndex>
  trending: MeilisearchResponse<AppsIndex>
  popular: MeilisearchResponse<AppsIndex>
  topAppsByCategory: {
    category: MainCategory
    apps: MeilisearchResponse<AppsIndex>
  }[]
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
  appOfTheDayAppstream: DesktopAppstream
  mobile: MeilisearchResponse<AppsIndex>
}) {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo description={t("flathub-description")} />
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-4">
          {heroBannerData.length > 0 && (
            <HeroBanner heroBannerData={heroBannerData} aboveTheFold={true} />
          )}
          <div className="flex flex-col lg:flex-row gap-4">
            <AppOfTheDay
              className="lg:w-1/2"
              appOfTheDay={appOfTheDayAppstream}
            />
            <div
              className={clsx(
                "lg:w-1/2",
                "rounded-xl",
                "flex min-w-0 items-center gap-4",
                "bg-repeat",
                "bg-[length:420px_420px]",
                "bg-bottom",
                "dark:bg-[url('/img/card-background-dark.webp')]",
                "bg-[url('/img/card-background.webp')]",
                "shadow-md",
                "overflow-hidden",
              )}
            >
              <div
                className={clsx(
                  "flex justify-between gap-3",
                  "dark:bg-flathub-arsenic/90",
                  "p-8 w-full h-full",
                )}
              >
                <div className="max-w-none">
                  <div className="mb-0 text-2xl font-extrabold">
                    {t("flathub-the-linux-app-store")}
                  </div>
                  <p className="introduction mb-4 mt-2 max-w-2xl">
                    {t("flathub-index-description")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      asChild
                      size="xl"
                      aria-label={t("setup-flathub-description")}
                    >
                      <Link href={"/setup"}>{t("setup-flathub")}</Link>
                    </Button>
                    {!IS_PRODUCTION && (
                      <Button
                        variant="secondary"
                        asChild
                        size="xl"
                        aria-label={t("donate-to", { project: "Flathub" })}
                      >
                        <Link href={"/donate"}>
                          {t("donate-to", { project: "Flathub" })}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TopSection
          topApps={[
            {
              apps: trending,
              name: "trending",
              moreLink: "/apps/collection/trending",
            },
            {
              apps: popular,
              name: "popular",
              moreLink: "/apps/collection/popular",
            },
            {
              apps: recentlyAdded,
              name: "new",
              moreLink: "/apps/collection/recently-added",
            },
            {
              apps: recentlyUpdated,
              name: "updated",
              moreLink: "/apps/collection/recently-updated",
            },
          ]}
        />

        <CategorySection topAppsByCategory={topAppsByCategory} />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  const recentlyUpdated = await fetchCollection(
    "recently-updated",
    1,
    APPS_IN_PREVIEW_COUNT * 2,
    locale,
  )
  const popular = await fetchCollection(
    "popular",
    1,
    APPS_IN_PREVIEW_COUNT,
    locale,
  )
  const recentlyAdded = await fetchCollection(
    "recently-added",
    1,
    APPS_IN_PREVIEW_COUNT,
    locale,
  )
  const trending = await fetchCollection(
    "trending",
    1,
    APPS_IN_PREVIEW_COUNT,
    locale,
  )

  const mobile = await fetchCollection(
    "mobile",
    1,
    APPS_IN_PREVIEW_COUNT,
    locale,
  )

  let topAppsByCategory: {
    category: MainCategory
    apps: MeilisearchResponse<AppsIndex>
  }[] = []

  const categoryPromise = Object.keys(MainCategory).map(
    async (category: MainCategory) => {
      return {
        category,
        apps: await fetchCategory(category, locale, 1, 6),
      }
    },
  )

  topAppsByCategory = await Promise.all(categoryPromise)

  topAppsByCategory = topAppsByCategory.sort((a, b) => {
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  })

  // remove duplicated apps
  recentlyUpdated.hits = recentlyUpdated.hits
    .filter(
      (app) => !recentlyAdded.hits.some((addedApp) => addedApp.id === app.id),
    )
    .slice(0, APPS_IN_PREVIEW_COUNT)

  const heroBannerApps = await fetchAppsOfTheWeek(
    formatISO(new Date(), { representation: "date" }),
  )
  const appOfTheDay = await fetchAppOfTheDay(
    formatISO(new Date(), { representation: "date" }),
  )

  const heroBannerAppstreams = await Promise.all(
    heroBannerApps.apps.map(async (app) => fetchAppstream(app.app_id, locale)),
  )

  const heroBannerData = heroBannerApps.apps.map((app) => {
    return {
      app: app,
      appstream: heroBannerAppstreams.find((a) => a.id === app.app_id),
    }
  })

  const appOfTheDayAppstream = await fetchAppstream(appOfTheDay.app_id, locale)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      trending,
      popular,
      topAppsByCategory,
      heroBannerData,
      appOfTheDayAppstream,
      mobile,
    },
    revalidate: 900,
  }
}
