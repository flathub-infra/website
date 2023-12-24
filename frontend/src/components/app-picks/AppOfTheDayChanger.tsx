import { useMutation, useQuery } from "@tanstack/react-query"
import { format, formatISO, isBefore, isSameDay } from "date-fns"
import { fetchAppstream } from "src/fetchers"
import { AppOfTheDay } from "../application/AppOfTheDay"
import Spinner from "../Spinner"
import { FlathubCombobox } from "../Combobox"
import { appPicks } from "src/api"
import { useUserContext } from "src/context/user-info"

export const AppOfTheDayChanger = ({ selectableApps, day }) => {
  const user = useUserContext()

  const queryAppOfTheDay = useQuery({
    queryKey: ["app-of-the-day", day],
    queryFn: async () => {
      const getAppsOfTheDay =
        await appPicks.getAppOfTheDayAppPicksAppOfTheDayDateGet(
          formatISO(day, { representation: "date" }),
        )

      const getAppOfTheDayInfo = await fetchAppstream(
        getAppsOfTheDay.data.app_id,
      )

      return getAppOfTheDayInfo
    },
    enabled: !!user.info?.["is-quality-moderator"],
  })

  const mutateAppOfTheDay = useMutation({
    mutationKey: ["app-of-the-day", "monday"],
    mutationFn: async (app: { id: string; day: Date }) => {
      await appPicks.setAppOfTheDayAppPicksAppOfTheDayPost(
        {
          app_id: app.id,
          day: formatISO(app.day, { representation: "date" }),
        },
        {
          withCredentials: true,
        },
      )

      await queryAppOfTheDay.refetch()
    },
  })

  const changeAppOfTheDay = async (app: {
    id: string
    name: string
  }): Promise<void> => {
    if (app) {
      mutateAppOfTheDay.mutateAsync({
        id: app.id,
        day: day,
      })
      await queryAppOfTheDay.refetch()
    }
  }

  return (
    <div>
      {format(day, "EEEE")}
      {queryAppOfTheDay.data && !queryAppOfTheDay.isFetching ? (
        <AppOfTheDay appOfTheDay={queryAppOfTheDay.data.data} />
      ) : (
        <Spinner size="m" />
      )}
      <FlathubCombobox
        disabled={isBefore(day, new Date()) && !isSameDay(day, new Date())}
        items={selectableApps}
        selected={queryAppOfTheDay.data?.data ?? null}
        setSelected={changeAppOfTheDay}
      />
    </div>
  )
}
