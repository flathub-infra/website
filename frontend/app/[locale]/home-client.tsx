"use client"

import { useTranslations } from "next-intl"
import { ReactElement, useCallback, useMemo } from "react"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../../src/env"
import { mapAppsIndexToAppstreamListItem } from "../../src/meilisearch"
import { categoryToName } from "../../src/types/Category"
import ApplicationSection from "../../src/components/application/ApplicationSection"
import { HeroBanner } from "../../src/components/application/HeroBanner"
import clsx from "clsx"
import { AppOfTheDay } from "../../src/components/application/AppOfTheDay"
import MultiToggle from "../../src/components/MultiToggle"
import { Button } from "@/components/ui/button"
import { MobileDevicesLogo } from "../../src/components/MobileDevicesLogo"
import {
  DesktopAppstream,
  MainCategory,
  MeilisearchResponseAppsIndex,
} from "../../src/codegen"
import { ApplicationSectionGradient } from "../../src/components/application/ApplicationSectionGradient"
import { GameControllersLogo } from "../../src/components/GameControllersLogo"
import { ApplicationSectionGradientMultiToggle } from "../../src/components/application/ApplicationSectionGradientMultiToggle"
import type { JSX } from "react"
import { Link } from "src/i18n/navigation"
import { useSearchParams } from "next/navigation"

interface HomeClientProps {
  recentlyUpdated: MeilisearchResponseAppsIndex
  recentlyAdded: MeilisearchResponseAppsIndex
  trending: MeilisearchResponseAppsIndex
  popular: MeilisearchResponseAppsIndex
  topAppsByCategory: {
    category: MainCategory
    apps: MeilisearchResponseAppsIndex
  }[]
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
  appOfTheDayAppstream: DesktopAppstream
  mobile: MeilisearchResponseAppsIndex
  games: MeilisearchResponseAppsIndex
  emulators: MeilisearchResponseAppsIndex
  gameLaunchers: MeilisearchResponseAppsIndex
  gameTools: MeilisearchResponseAppsIndex
}

function MobileSection({ mobile }: { mobile: MeilisearchResponseAppsIndex }) {
  const t = useTranslations()

  return (
    <ApplicationSectionGradient
      mobile={mobile}
      title={t("on-the-go")}
      description={t("mobile-apps-description")}
      logo={<MobileDevicesLogo />}
      moreLinkLabel={t("more-mobile-apps")}
      moreLink="/apps/collection/mobile"
    />
  )
}

function GameSection({
  games,
  emulators,
  gameLaunchers,
  gameTools,
}: {
  games: MeilisearchResponseAppsIndex
  emulators: MeilisearchResponseAppsIndex
  gameLaunchers: MeilisearchResponseAppsIndex
  gameTools: MeilisearchResponseAppsIndex
}) {
  const t = useTranslations()

  const gameAppsData = [
    {
      apps: games,
      name: "games",
      moreLink: "/apps/category/game",
      moreLinkLabel: "more-game",
    },
    {
      apps: emulators,
      name: "gameemulator",
      moreLink: "/apps/category/game/subcategories/Emulator",
      moreLinkLabel: "more-emulator",
    },
    {
      apps: gameLaunchers,
      name: "gamelauncher",
      moreLink: "/apps/category/game/subcategories/Launcher",
      moreLinkLabel: "more-gamelauncher",
    },
    {
      apps: gameTools,
      name: "gametool",
      moreLink: "/apps/category/game/subcategories/Tool",
      moreLinkLabel: "more-gametool",
    },
  ]

  return (
    <ApplicationSectionGradientMultiToggle
      apps={gameAppsData}
      sectionKey="games"
      title={t("we-love-games")}
      description={t("game-section-description")}
      logo={<GameControllersLogo />}
    />
  )
}

function CategorySection({
  topAppsByCategory,
  mobileSection,
  gameSection,
}: {
  topAppsByCategory: {
    category: MainCategory
    apps: MeilisearchResponseAppsIndex
  }[]
  mobileSection: ReactElement
  gameSection: ReactElement
}) {
  const t = useTranslations()

  const categorySections = useMemo(
    () =>
      topAppsByCategory.map((sectionData) => ({
        category: sectionData.category,
        applications: sectionData.apps.hits.map((app) =>
          mapAppsIndexToAppstreamListItem(app),
        ),
      })),
    [topAppsByCategory],
  )

  return (
    <>
      {categorySections.map((sectionData, i) => (
        <div key={`categorySection${sectionData.category}`}>
          {i === 3 && <div className="mb-10">{mobileSection}</div>}
          {i === 5 && <div className="mb-10">{gameSection}</div>}
          <ApplicationSection
            type="withCustomHeader"
            href={`/apps/category/${encodeURIComponent(sectionData.category)}`}
            applications={sectionData.applications}
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
        </div>
      ))}
    </>
  )
}

function TopSection({
  topApps,
}: {
  topApps: {
    name: string
    apps: MeilisearchResponseAppsIndex
    moreLink: string
  }[]
}) {
  const t = useTranslations()
  const searchParams = useSearchParams()

  const categoryParam = searchParams.get("category")

  const selectedApps =
    topApps.find((app) => app.name === categoryParam) ?? topApps[0]

  const handleToggleClick = useCallback(
    (app: (typeof topApps)[0]) => {
      // Update URL without triggering navigation using History API
      const params = new URLSearchParams(searchParams.toString())
      params.set("category", app.name)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, "", newUrl)
    },
    [searchParams],
  )

  const toggleItems = useMemo(
    () =>
      topApps.map((x) => ({
        id: x.name,
        content: <div className="font-semibold truncate">{t(x.name)}</div>,
        selected: x.name === selectedApps.name,
        onClick: () => handleToggleClick(x),
      })),
    [topApps, selectedApps.name, t, handleToggleClick],
  )

  const applications = useMemo(
    () =>
      selectedApps.apps.hits.map((app) => mapAppsIndexToAppstreamListItem(app)),
    [selectedApps.apps.hits],
  )

  return (
    <ApplicationSection
      type="withCustomHeader"
      key={`topSection${selectedApps.name}`}
      href={selectedApps.moreLink}
      applications={applications}
      numberOfApps={APPS_IN_PREVIEW_COUNT}
      customHeader={
        <MultiToggle items={toggleItems} size={"lg"} variant="secondary" />
      }
      showMore={true}
      moreText={t(`more-${selectedApps.name}`)}
    />
  )
}

function HomeClient({
  recentlyUpdated,
  recentlyAdded,
  trending,
  popular,
  topAppsByCategory,
  heroBannerData,
  appOfTheDayAppstream,
  mobile,
  games,
  emulators,
  gameLaunchers,
  gameTools,
}: HomeClientProps): JSX.Element {
  const t = useTranslations()

  const topAppsData = [
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
  ]

  const mobileSection = <MobileSection mobile={mobile} />

  const gameSection = (
    <GameSection
      games={games}
      emulators={emulators}
      gameLaunchers={gameLaunchers}
      gameTools={gameTools}
    />
  )

  return (
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
              "dark:bg-[url('https://dl.flathub.org/assets/_next/public/img/card-background-dark.webp')]",
              "bg-[url('https://dl.flathub.org/assets/_next/public/img/card-background.webp')]",
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
                      aria-label={t("donate-to", { project: t("flathub") })}
                    >
                      <Link href={"/donate"}>
                        {t("donate-to", { project: t("flathub") })}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TopSection topApps={topAppsData} />

      <CategorySection
        topAppsByCategory={topAppsByCategory}
        mobileSection={mobileSection}
        gameSection={gameSection}
      />
    </div>
  )
}

export default HomeClient
