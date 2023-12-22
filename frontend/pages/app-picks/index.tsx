import { useMutation, useQuery } from "@tanstack/react-query"
import {
  addDays,
  endOfISOWeek,
  formatISO,
  getISOWeek,
  startOfISOWeek,
  startOfWeek,
} from "date-fns"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement, useEffect, useState } from "react"
import Button from "src/components/Button"
import { FlathubCombobox } from "src/components/Combobox"
import Spinner from "src/components/Spinner"
import { HeroBanner } from "src/components/application/HeroBanner"
import { useUserContext } from "src/context/user-info"
import { fetchAppstream } from "src/fetchers"
import { appPicks, qualityModerationApi } from "src/api"
import { AppOfTheDay } from "src/components/application/AppOfTheDay"
import { UserState } from "src/types/Login"

export default function AppPicks() {
  const { t } = useTranslation()
  const user = useUserContext()

  const [date, setDate] = useState(new Date())

  const [selectableApps, setSelectableApps] = useState<
    { id: string; name: string }[]
  >([])

  const [firstApp, setFirstApp] = useState<{ id: string; name: string } | null>(
    null,
  )

  const [secondApp, setSecondApp] = useState<{
    id: string
    name: string
  } | null>(null)

  const [thirdApp, setThirdApp] = useState<{
    id: string
    name: string
  } | null>(null)

  const [fourthApp, setFourthApp] = useState<{
    id: string
    name: string
  } | null>(null)

  const [fifthApp, setFifthApp] = useState<{
    id: string
    name: string
  } | null>(null)

  const mutateAppForWeek = useMutation({
    mutationKey: ["app-of-the-week", date],
    mutationFn: async (app: { id: string; name: string; position: number }) => {
      await appPicks.setAppOfTheWeekAppPicksAppOfTheWeekPost(
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

      await query.refetch()
    },
  })

  const query = useQuery({
    queryKey: ["app-of-the-week", date],
    queryFn: async () => {
      const getAppsOfTheWeek =
        await appPicks.getAppOfTheWeekAppPicksAppsOfTheWeekDateGet(
          formatISO(date, { representation: "date" }),
        )

      const getAppOfTheWeekInfo = await Promise.all(
        getAppsOfTheWeek.data.apps.map((app) => fetchAppstream(app.app_id)),
      ).then((apps) => apps.map((app) => app.data))

      const setAppDefault = async (position: number) => {
        const currentApp = getAppsOfTheWeek.data.apps.find(
          (app) => app.position === position + 1,
        )

        if (currentApp) {
          const appInfo = await fetchAppstream(currentApp.app_id)

          return {
            id: appInfo.data.id,
            name: appInfo.data.name,
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

      return getAppOfTheWeekInfo
    },
    enabled: !!user.info?.["is-quality-moderator"],
  })

  const queryQualityApps = useQuery({
    queryKey: ["potential-passing-apps"],
    queryFn: async () => {
      const getAppsWithQuality =
        await qualityModerationApi.getQualityModerationStatusQualityModerationStatusGet(
          1,
          9999999,
          "passing",
          {
            withCredentials: true,
          },
        )

      const passingApps = Promise.all(
        getAppsWithQuality.data.apps
          .filter((app) => app.quality_moderation_status.passes)
          .map((app) => {
            return fetchAppstream(app.id)
          }),
      )

      return passingApps
    },
    enabled: !!user.info?.["is-quality-moderator"],
  })

  const startOfThisWeek = startOfISOWeek(date)
  const queryAppOfTheDayMonday = GetAppOfTheDay(
    addDays(startOfThisWeek, 0),
    user,
  )
  const queryAppOfTheDayTuesday = GetAppOfTheDay(
    addDays(startOfThisWeek, 1),
    user,
  )
  const queryAppOfTheDayWednesday = GetAppOfTheDay(
    addDays(startOfThisWeek, 2),
    user,
  )
  const queryAppOfTheDayThursday = GetAppOfTheDay(
    addDays(startOfThisWeek, 3),
    user,
  )
  const queryAppOfTheDayFriday = GetAppOfTheDay(
    addDays(startOfThisWeek, 4),
    user,
  )
  const queryAppOfTheDaySaturday = GetAppOfTheDay(
    addDays(startOfThisWeek, 5),
    user,
  )
  const queryAppOfTheDaySunday = GetAppOfTheDay(
    addDays(startOfThisWeek, 6),
    user,
  )

  function GetAppOfTheDay(date: Date, user: UserState) {
    return useQuery({
      queryKey: ["app-of-the-day", date],
      queryFn: async () => {
        const getAppsOfTheDay =
          await appPicks.getAppOfTheDayAppPicksAppOfTheDayDateGet(
            formatISO(date, { representation: "date" }),
          )

        const getAppOfTheDayInfo = await fetchAppstream(
          getAppsOfTheDay.data.app_id,
        )

        return getAppOfTheDayInfo
      },
      enabled: !!user.info?.["is-quality-moderator"],
    })
  }

  useEffect(() => {
    if (queryQualityApps.data) {
      const apps = queryQualityApps.data
        .filter((app) => app.data.id !== firstApp?.id)
        .filter((app) => app.data.id !== secondApp?.id)
        .filter((app) => app.data.id !== thirdApp?.id)
        .filter((app) => app.data.id !== fourthApp?.id)
        .filter((app) => app.data.id !== fifthApp?.id)
        .map((app) => {
          return {
            id: app.data.id,
            name: app.data.name,
            subtitle: app.data.id,
          }
        })

      setSelectableApps(apps)
    }
  }, [
    fifthApp?.id,
    firstApp?.id,
    fourthApp?.id,
    query.data,
    queryQualityApps.data,
    secondApp?.id,
    thirdApp?.id,
  ])

  let content: ReactElement

  if (!user.info || !user.info["is-quality-moderator"]) {
    content = (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>
      </>
    )
  } else if (query.isPending || queryQualityApps.isPending) {
    content = <Spinner size="m" />
  } else if (query.isError || queryQualityApps.isError) {
    content = (
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
    )
  } else {
    content = (
      <>
        <h1 className="mt-8 text-4xl font-extrabold">App picks</h1>
        <div className="text-sm">
          For week {getISOWeek(date)} of {date.getFullYear()}
        </div>
        <div className="text-sm">
          {startOfISOWeek(date).toDateString()} to{" "}
          {endOfISOWeek(date).toDateString()}
        </div>

        <div className="flex flex-col lg:flex-row gap-2 justify-between">
          <FlathubCombobox
            items={selectableApps}
            selected={firstApp}
            setSelected={(app) => {
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
            selected={secondApp}
            setSelected={(app) => {
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
            selected={thirdApp}
            setSelected={(app) => {
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
            selected={fourthApp}
            setSelected={(app) => {
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
            selected={fifthApp}
            setSelected={(app) => {
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
            disabled={
              addDays(startOfISOWeek(date), -1) < startOfWeek(new Date())
            }
            onClick={() => {
              setDate(addDays(startOfISOWeek(date), -1))
            }}
          >
            Previous week
          </Button>
          <Button
            onClick={() => {
              setDate(addDays(endOfISOWeek(date), 1))
            }}
          >
            Next week
          </Button>
        </div>

        <h2 className="text-2xl my-4">Preview</h2>
        {query.data.length > 0 && !query.isFetching ? (
          <HeroBanner appstreams={query.data} />
        ) : (
          <div className="text-sm">
            No apps for this week. Please select apps above.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
          <div>
            Monday
            {queryAppOfTheDayMonday.data &&
            !queryAppOfTheDayMonday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDayMonday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Tuesday
            {queryAppOfTheDayTuesday.data &&
            !queryAppOfTheDayTuesday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDayTuesday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Wednesday
            {queryAppOfTheDayWednesday.data &&
            !queryAppOfTheDayWednesday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDayWednesday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Thursday
            {queryAppOfTheDayThursday.data &&
            !queryAppOfTheDayThursday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDayThursday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Friday
            {queryAppOfTheDayFriday.data &&
            !queryAppOfTheDayFriday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDayFriday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Saturday
            {queryAppOfTheDaySaturday.data &&
            !queryAppOfTheDaySaturday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDaySaturday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
          <div>
            Sunday
            {queryAppOfTheDaySunday.data &&
            !queryAppOfTheDaySunday.isFetching ? (
              <AppOfTheDay appOfTheDay={queryAppOfTheDaySunday.data.data} />
            ) : (
              <Spinner size="m" />
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="App picks" />
      {content}
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
