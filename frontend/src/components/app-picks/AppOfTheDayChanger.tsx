import { useMutation, useQuery } from "@tanstack/react-query"
import { format, formatISO, isBefore, isSameDay } from "date-fns"
import { fetchAppstream } from "src/fetchers"
import { AppOfTheDay } from "../application/AppOfTheDay"
import Spinner from "../Spinner"
import { FlathubCombobox } from "../Combobox"
import { appPicks } from "src/api"
import { useUserContext } from "src/context/user-info"
import { ReactElement } from "react"
import clsx from "clsx"
import { HiCheck } from "react-icons/hi2"
import LogoImage from "../LogoImage"

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
    enabled: !!user.info?.is_quality_moderator,
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
      {queryAppOfTheDay.isPending ? (
        <Spinner size="m" />
      ) : (
        <AppOfTheDay appOfTheDay={queryAppOfTheDay.data.data} />
      )}
      <FlathubCombobox
        disabled={isBefore(day, new Date()) && !isSameDay(day, new Date())}
        items={selectableApps}
        selectedItem={queryAppOfTheDay.data?.data ?? null}
        setSelectedItem={changeAppOfTheDay}
        renderItem={(active, selected, item) => (
          <ComboboxItem active={active} selected={selected} item={item} />
        )}
      />
    </div>
  )
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
