import { useMutation, useQuery } from "@tanstack/react-query"
import {
  addDays,
  endOfISOWeek,
  formatDistanceToNow,
  formatISO,
  getISOWeek,
  startOfISOWeek,
} from "date-fns"
import { GetStaticProps } from "next"
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
  getAppPickRecommendationsQualityModerationAppPickRecommendationsGet,
} from "src/codegen"
import AdminLayout from "src/components/AdminLayout"
import { DesktopAppstream } from "src/types/Appstream"
import { Button } from "@/components/ui/button"
import { UTCDate } from "@date-fns/utc"
import { useTranslations } from "next-intl"
import { translationMessages } from "i18n/request"

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
  const t = useTranslations()
  const user = useUserContext()

  const [date, setDate] = useState(new Date())
  const [currentIndex, setCurrentIndex] = useState(-1)

  const [selectableAppsAppOfTheDay, setSelectableAppsAppOfTheDay] = useState<
    {
      id: string
      name: string
      subtitle: string
      icon: string
      lastTimeAppOfTheDay: UTCDate
      lastTimeAppOfTheWeek: UTCDate
      numberOfTimesAppOfTheDay: number
      numberOfTimesAppOfTheWeek: number
    }[]
  >([])

  const [selectableAppsAppsOfTheWeek, setSelectableAppsAppsOfTheWeek] =
    useState<
      {
        id: string
        name: string
        subtitle: string
        icon: string
        lastTimeAppOfTheDay: UTCDate
        lastTimeAppOfTheWeek: UTCDate
        numberOfTimesAppOfTheDay: number
        numberOfTimesAppOfTheWeek: number
      }[]
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
    queryKey: ["potential-passing-apps", date],
    queryFn: async () => {
      const getAppsWithQuality =
        await getAppPickRecommendationsQualityModerationAppPickRecommendationsGet(
          {
            recommendation_date: formatISO(date, { representation: "date" }),
          },
          {
            withCredentials: true,
          },
        )

      const passingApps = await Promise.all(
        getAppsWithQuality.data.recommendations.map(async (app) => {
          return {
            id: app.app_id,
            lastTimeAppOfTheDay: app.lastTimeAppOfTheDay,
            lastTimeAppOfTheWeek: app.lastTimeAppOfTheWeek,
            numberOfTimesAppOfTheDay: app.numberOfTimesAppOfTheDay,
            numberOfTimesAppOfTheWeek: app.numberOfTimesAppOfTheWeek,
            appstream: await fetchAppstream(app.app_id, "en"),
          }
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
            name: app.appstream.name,
            subtitle: app.appstream.summary,
            icon: app.appstream.icon,
            lastTimeAppOfTheDay: new UTCDate(app.lastTimeAppOfTheDay),
            numberOfTimesAppOfTheDay: app.numberOfTimesAppOfTheDay,
            lastTimeAppOfTheWeek: new UTCDate(app.lastTimeAppOfTheWeek),
            numberOfTimesAppOfTheWeek: app.numberOfTimesAppOfTheWeek,
          }
        })

      setSelectableAppsAppOfTheDay(
        apps.toSorted((a, b) => {
          if (a.numberOfTimesAppOfTheDay - b.numberOfTimesAppOfTheDay !== 0) {
            return a.numberOfTimesAppOfTheDay - b.numberOfTimesAppOfTheDay
          }

          if (a.lastTimeAppOfTheDay && b.lastTimeAppOfTheDay) {
            return (
              a.lastTimeAppOfTheDay.getTime() - b.lastTimeAppOfTheDay.getTime()
            )
          }

          return 0
        }),
      )

      setSelectableAppsAppsOfTheWeek(
        apps.toSorted((a, b) => {
          if (a.numberOfTimesAppOfTheWeek - b.numberOfTimesAppOfTheWeek !== 0) {
            return a.numberOfTimesAppOfTheWeek - b.numberOfTimesAppOfTheWeek
          }

          if (b.lastTimeAppOfTheWeek && a.lastTimeAppOfTheWeek) {
            return (
              a.lastTimeAppOfTheWeek.getTime() -
              b.lastTimeAppOfTheWeek.getTime()
            )
          }

          return 0
        }),
      )
    }
  }, [
    firstApp?.id,
    secondApp?.id,
    thirdApp?.id,
    fourthApp?.id,
    fifthApp?.id,
    queryAppsOfTheWeek.data,
    queryQualityApps.data,
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
            {t.rich("retry-or-go-home", {
              link: (chunk) => (
                <a className="no-underline hover:underline" href=".">
                  {chunk}
                </a>
              ),
            })}
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
              items={selectableAppsAppsOfTheWeek}
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
              items={selectableAppsAppsOfTheWeek}
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
              items={selectableAppsAppsOfTheWeek}
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
              items={selectableAppsAppsOfTheWeek}
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
              items={selectableAppsAppsOfTheWeek}
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
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 1)}
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 2)}
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 3)}
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 4)}
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 5)}
              selectableApps={selectableAppsAppOfTheDay}
            />
            <AppOfTheDayChanger
              day={addDays(startOfThisWeek, 6)}
              selectableApps={selectableAppsAppOfTheDay}
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
      messages: await translationMessages(locale),
    },
    revalidate: 900,
  }
}

const ComboboxItem = ({
  active,
  selected,
  item,
}: {
  active: boolean
  selected: boolean
  item: {
    id: string
    name: string
    subtitle: string
    icon: string
    lastTimeAppOfTheWeek?: UTCDate
    numberOfTimesAppOfTheWeek?: number
  }
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
        {item.numberOfTimesAppOfTheWeek > 0 && (
          <span
            className={clsx(
              "flex truncate gap-6 text-sm opacity-70 justify-between",
            )}
          >
            Last picked
            <strong>
              {formatDistanceToNow(item.lastTimeAppOfTheWeek, {
                addSuffix: true,
              })}
            </strong>
          </span>
        )}
        {item.numberOfTimesAppOfTheWeek > 0 && (
          <span
            className={clsx(
              "flex truncate gap-6 text-sm opacity-70 justify-between",
            )}
          >
            Times picked <strong>{item.numberOfTimesAppOfTheWeek}</strong>
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
