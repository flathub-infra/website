"use client"

import { useTranslations } from "next-intl"
import { ReactElement, useEffect, useState } from "react"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../../src/env"
import { mapAppsIndexToAppstreamListItem } from "../../src/meilisearch"
import { categoryToName } from "../../src/types/Category"
import ApplicationSection from "../../src/components/application/ApplicationSection"
import { HeroBanner } from "../../src/components/application/HeroBanner"
import { DesktopAppstream } from "../../src/types/Appstream"
import clsx from "clsx"
import { AppOfTheDay } from "../../src/components/application/AppOfTheDay"
import MultiToggle from "../../src/components/MultiToggle"
import { Button } from "@/components/ui/button"
import { MobileDevicesLogo } from "../../src/components/MobileDevicesLogo"
import { MainCategory, MeilisearchResponseAppsIndex } from "../../src/codegen"
import { ApplicationSectionGradient } from "../../src/components/application/ApplicationSectionGradient"
import { GameControllersLogo } from "../../src/components/GameControllersLogo"
import { ApplicationSectionGradientMultiToggle } from "../../src/components/application/ApplicationSectionGradientMultiToggle"
import type { JSX } from "react"
import { Link, useRouter } from "src/i18n/navigation"
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

const MobileSection = ({
  mobile,
}: {
  mobile: MeilisearchResponseAppsIndex
}) => {
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

const GameSection = ({
  games,
  emulators,
  gameLaunchers,
  gameTools,
}: {
  games: MeilisearchResponseAppsIndex
  emulators: MeilisearchResponseAppsIndex
  gameLaunchers: MeilisearchResponseAppsIndex
  gameTools: MeilisearchResponseAppsIndex
}) => {
  const t = useTranslations()

  return (
    <ApplicationSectionGradientMultiToggle
      apps={[
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
      ]}
      sectionKey="games"
      title={t("we-love-games")}
      description={t("game-section-description")}
      logo={<GameControllersLogo />}
    />
  )
}

const CategorySection = ({
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
}) => {
  const t = useTranslations()

  return (
    <>
      {topAppsByCategory.map((sectionData, i) => (
        <div key={`categorySection${sectionData.category}`}>
          {i === 3 && mobileSection}
          {i === 5 && gameSection}
          <ApplicationSection
            type="withCustomHeader"
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
        </div>
      ))}
    </>
  )
}

const TopSection = ({
  topApps,
}: {
  topApps: {
    name: string
    apps: MeilisearchResponseAppsIndex
    moreLink: string
  }[]
}) => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedName, setSelectedName] = useState<string>(topApps[0].name)
  const [selectedApps, setSelectedApps] = useState<{
    name: string
    apps: MeilisearchResponseAppsIndex
    moreLink: string
  }>(topApps[0])

  useEffect(() => {
    const categoryParam = searchParams.get("category")
    if (categoryParam) {
      const foundApps = topApps.find(
        (sectionData) => sectionData.name === categoryParam,
      )
      if (foundApps) {
        setSelectedName(categoryParam)
        setSelectedApps(foundApps)
      }
    }
  }, [])

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
        <MultiToggle
          items={topApps.map((x) => ({
            id: x.name,
            content: <div className="font-semibold truncate">{t(x.name)}</div>,
            selected: x.name === selectedName,
            onClick: () => {
              setSelectedName(x.name)
              // Update URL without page reload using app router navigation
              const url = new URL(window.location.href)
              url.searchParams.set("category", x.name)
              router.replace(url.search, { scroll: false })
            },
          }))}
          size={"lg"}
          variant="secondary"
        />
      }
      showMore={true}
      moreText={t(`more-${selectedApps.name}`)}
    />
  )
}

const HomeClient = ({
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
}: HomeClientProps): JSX.Element => {
  const t = useTranslations()

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

      <CategorySection
        topAppsByCategory={topAppsByCategory}
        mobileSection={<MobileSection mobile={mobile} />}
        gameSection={
          <GameSection
            games={games}
            emulators={emulators}
            gameLaunchers={gameLaunchers}
            gameTools={gameTools}
          />
        }
      />
    </div>
  )
}

export default HomeClient
