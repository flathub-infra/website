import { useMutation, useQuery } from "@tanstack/react-query"
import {
  addDays,
  endOfISOWeek,
  formatISO,
  getISOWeek,
  startOfISOWeek,
} from "date-fns"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement, useEffect, useState } from "react"
import { FlathubCombobox } from "src/components/Combobox"
import Spinner from "src/components/Spinner"
import { HeroBanner } from "src/components/application/HeroBanner"
import { useUserContext } from "src/context/user-info"
import { fetchAppsOfTheWeek, fetchAppstream } from "src/fetchers"
import { AppOfTheDayChanger } from "src/components/app-picks/AppOfTheDayChanger"
import clsx from "clsx"
import { HiCheck } from "react-icons/hi2"
import LogoImage from "src/components/LogoImage"
import {
  UserInfo,
  setAppOfTheWeekAppPicksAppOfTheWeekPost,
  Permission,
  getQualityModerationStatusQualityModerationStatusGet,
} from "src/codegen"
import AdminLayout from "src/components/AdminLayout"
import { DesktopAppstream } from "src/types/Appstream"
import { Button } from "@/components/ui/button"

AppPicks.getLayout = function getLayout(page: ReactElement) {
  return (
    <AdminLayout
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission["quality-moderation"])
      }
    >
      {page}
    </AdminLayout>
  )
}

export default function AppPicks() {
  const { t } = useTranslation()
  const user = useUserContext()

  const [date, setDate] = useState(new Date())
  const [currentIndex, setCurrentIndex] = useState(-1)

  const [selectableApps, setSelectableApps] = useState<
    { id: string; name: string; subtitle: string; icon: string }[]
  >([])

  const [firstApp, setFirstApp] = useState<{
    id: string
    name: string
    subtitle: string
    icon: string
  } | null>(null)

  const [secondApp, setSecondApp] = useState<{
    id: string
    name: string
    subtitle: string
    icon: string
  } | null>(null)

  const [thirdApp, setThirdApp] = useState<{
    id: string
    name: string
    subtitle: string
    icon: string
  } | null>(null)

  const [fourthApp, setFourthApp] = useState<{
    id: string
    name: string
    subtitle: string
    icon: string
  } | null>(null)

  const [fifthApp, setFifthApp] = useState<{
    id: string
    name: string
    subtitle: string
    icon: string
  } | null>(null)

  const mutateAppForWeek = useMutation({
    mutationKey: ["app-of-the-week", date],
    mutationFn: async (app: { id: string; name: string; position: number }) => {
      await setAppOfTheWeekAppPicksAppOfTheWeekPost(
        {
          app_id: app.id,
          weekNumber: getISOWeek(date),
          year: date.getFullYear(),
          position: app.position,
        },
        {
          withCredentials: true,
        },
      )

      await queryAppsOfTheWeek.refetch()
      return app
    },
    onSuccess: (app) => {
      setCurrentIndex(app.position - 1)
    },
  })

  const queryAppsOfTheWeek = useQuery({
    queryKey: ["apps-of-the-week", date],
    queryFn: async () => {
      const getAppsOfTheWeek = await fetchAppsOfTheWeek(
        formatISO(date, { representation: "date" }),
      )

      const heroBannerAppstreams = await Promise.all(
        getAppsOfTheWeek.apps.map(async (app) =>
          fetchAppstream(app.app_id, "en"),
        ),
      )

      const heroBannerData = getAppsOfTheWeek.apps.map((app) => {
        return {
          app: app,
          appstream: heroBannerAppstreams.find(
            (a) => a.id === app.app_id,
          ) as DesktopAppstream,
        }
      })

      const setAppDefault = async (position: number) => {
        const currentApp = getAppsOfTheWeek.apps.find(
          (app) => app.position === position + 1,
        )

        if (currentApp) {
          const appInfo = await fetchAppstream(currentApp.app_id, "en")

          return {
            id: appInfo.id,
            name: appInfo.name,
            subtitle: appInfo.summary,
            icon: appInfo.icon,
          }
        } else {
          return null
        }
      }

      setFirstApp(await setAppDefault(0))
      setSecondApp(await setAppDefault(1))
      setThirdApp(await setAppDefault(2))
      setFourthApp(await setAppDefault(3))
      setFifthApp(await setAppDefault(4))

      return heroBannerData
    },
    enabled: !!user.info?.permissions.some(
      (a) => a === Permission["quality-moderation"],
    ),
  })

  const queryQualityApps = useQuery({
    queryKey: ["potential-passing-apps"],
    queryFn: async () => {
      const getAppsWithQuality =
        await getQualityModerationStatusQualityModerationStatusGet(
          {
            page: 1,
            page_size: 9999999,
            filter: "passing",
          },
          {
            withCredentials: true,
          },
        )

      const passingApps = Promise.all(
        getAppsWithQuality.data.apps
          .filter((app) => app.quality_moderation_status.passes)
          .map((app) => {
            return fetchAppstream(app.id, "en")
          }),
      )

      return passingApps
    },
    enabled: !!user.info?.permissions.some(
      (a) => a === Permission["quality-moderation"],
    ),
  })

  const startOfThisWeek = startOfISOWeek(date)

  useEffect(() => {
    if (queryQualityApps.data) {
      const apps = queryQualityApps.data
        .filter((app) => app.id !== firstApp?.id)
        .filter((app) => app.id !== secondApp?.id)
        .filter((app) => app.id !== thirdApp?.id)
        .filter((app) => app.id !== fourthApp?.id)
        .filter((app) => app.id !== fifthApp?.id)
        .map((app) => {
          return {
            id: app.id,
            name: app.name,
            subtitle: app.summary,
            icon: app.icon,
          }
        })

      setSelectableApps(apps)
    }
  }, [
    fifthApp?.id,
    firstApp?.id,
    fourthApp?.id,
    queryAppsOfTheWeek.data,
    queryQualityApps.data,
    secondApp?.id,
    thirdApp?.id,
  ])

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="App Picks" noindex />
      {queryAppsOfTheWeek.isPending || queryQualityApps.isPending ? (
        <Spinner size="m" />
      ) : queryAppsOfTheWeek.isError || queryQualityApps.isError ? (
        <>
          <h1 className="my-8">{t("whoops")}</h1>

          <p>{t("an-error-occurred-server", { errorCode: "500" })}</p>
          <p>
            <Trans i18nKey={"common:retry-or-go-home"}>
              You might want to retry or go back{" "}
              <a className="no-underline hover:underline" href=".">
                home
              </a>
              .
            </Trans>
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-8 text-4xl font-extrabold">App Picks</h1>
          <div className="text-sm flex">
            For week {getISOWeek(date)} of {date.getFullYear()}
          </div>
          <div className="text-sm">
            {startOfThisWeek.toDateString()} to{" "}
            {endOfISOWeek(date).toDateString()}
          </div>

          <div className="flex flex-col lg:flex-row gap-2 justify-between">
            <FlathubCombobox
              items={selectableApps}
              selectedItem={firstApp}
              renderItem={(active, selected, item) => (
                <ComboboxItem active={active} selected={selected} item={item} />
              )}
              setSelectedItem={(app) => {
                setFirstApp(app)
                if (app) {
                  mutateAppForWeek.mutateAsync({
                    id: app.id,
                    name: app.name,
                    position: 1,
                  })
                }
              }}
            />
            <FlathubCombobox
              items={selectableApps}
              selectedItem={secondApp}
              renderItem={(active, selected, item) => (
                <ComboboxItem active={active} selected={selected} item={item} />
              )}
              setSelectedItem={(app) => {
                setSecondApp(app)
                if (app) {
                  mutateAppForWeek.mutateAsync({
                    id: app.id,
                    name: app.name,
                    position: 2,
                  })
                }
              }}
            />
            <FlathubCombobox
              items={selectableApps}
              selectedItem={thirdApp}
              renderItem={(active, selected, item) => (
                <ComboboxItem active={active} selected={selected} item={item} />
              )}
              setSelectedItem={(app) => {
                setThirdApp(app)
                if (app) {
                  mutateAppForWeek.mutateAsync({
                    id: app.id,
                    name: app.name,
                    position: 3,
                  })
                }
              }}
            />
            <FlathubCombobox
              items={selectableApps}
              selectedItem={fourthApp}
              renderItem={(active, selected, item) => (
                <ComboboxItem active={active} selected={selected} item={item} />
              )}
              setSelectedItem={(app) => {
                setFourthApp(app)
                if (app) {
                  mutateAppForWeek.mutateAsync({
                    id: app.id,
                    name: app.name,
                    position: 4,
                  })
                }
              }}
            />
            <FlathubCombobox
              items={selectableApps}
              selectedItem={fifthApp}
              renderItem={(active, selected, item) => (
                <ComboboxItem active={active} selected={selected} item={item} />
              )}
              setSelectedItem={(app) => {
                setFifthApp(app)
                if (app) {
                  mutateAppForWeek.mutateAsync({
                    id: app.id,
                    name: app.name,
                    position: 5,
                  })
                }
              }}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button
              size="lg"
              onClick={() => {
                setDate(addDays(startOfISOWeek(date), -1))
              }}
            >
              Previous week
            </Button>
            <Button
              size="lg"
              onClick={() => {
                setDate(addDays(endOfISOWeek(date), 1))
              }}
            >
              Next week
            </Button>
          </div>

          <h2 className="text-2xl my-4">Preview</h2>
          {queryAppsOfTheWeek.data.length > 0 &&
          !queryAppsOfTheWeek.isPending ? (
            <HeroBanner
              heroBannerData={queryAppsOfTheWeek.data}
              currentIndex={currentIndex}
              autoplay={false}
            />
          ) : (
            <div className="text-sm">
              No apps for this week. Please select apps above.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 0)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 1)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 2)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 3)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 4)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 5)}
              selectableApps={selectableApps}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 6)}
              selectableApps={selectableApps}
            />
          </div>
        </>
      )}
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}

const ComboboxItem = ({
  active,
  selected,
  item,
}: {
  active: boolean
  selected: boolean
  item: { id: string; name: string; subtitle: string; icon: string }
}): ReactElement => {
  return (
    <div className="flex gap-2 items-center cursor-pointer">
      <LogoImage iconUrl={item.icon} appName={item.name} size="24" />
      <div className="flex flex-col">
        <span
          className={clsx(
            "block truncate font-semibold",
            active && "font-bold",
          )}
        >
          {item.name}
        </span>
        {item.subtitle && (
          <span className={clsx("block truncate text-sm opacity-70")}>
            {item.subtitle}
          </span>
        )}
        {selected && (
          <span
            className={clsx(
              "absolute inset-y-0 right-0 flex items-center pe-4",
              active ? "text-white" : "text-flathub-bg-flathub-celestial-blue",
            )}
          >
            <HiCheck className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  )
}
