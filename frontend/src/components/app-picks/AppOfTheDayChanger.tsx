import { useMutation, useQuery } from "@tanstack/react-query"
import {
  format,
  formatDistanceToNow,
  formatISO,
  isBefore,
  isSameDay,
} from "date-fns"
import { fetchAppOfTheDay, fetchAppstream } from "src/fetchers"
import { AppOfTheDay } from "../application/AppOfTheDay"
import Spinner from "../Spinner"
import { FlathubCombobox } from "../Combobox"
import { useUserContext } from "src/context/user-info"
import { ReactElement } from "react"
import clsx from "clsx"
import { CheckIcon } from "@heroicons/react/20/solid"
import LogoImage from "../LogoImage"
import { setAppOfTheDayAppPicksAppOfTheDayPost, Permission } from "src/codegen"
import { DesktopAppstream } from "src/types/Appstream"
import { UTCDate } from "@date-fns/utc"

export const AppOfTheDayChanger = ({ selectableApps, day }) => {
  const user = useUserContext()

  const queryAppOfTheDay = useQuery({
    queryKey: ["app-of-the-day", day],
    queryFn: async () => {
      const getAppsOfTheDay = await fetchAppOfTheDay(
        formatISO(day, { representation: "date" }),
      )

      if ("error" in getAppsOfTheDay) {
        throw new Error(
          `Failed to fetch app of the day: ${getAppsOfTheDay.error}`,
        )
      }

      const getAppOfTheDayInfo = await fetchAppstream(
        getAppsOfTheDay.app_id,
        "en",
      )

      if ("error" in getAppOfTheDayInfo) {
        throw new Error(`Failed to fetch app info: ${getAppOfTheDayInfo.error}`)
      }

      return getAppOfTheDayInfo
    },
    enabled: !!user.info?.permissions.some(
      (a) => a === Permission["quality-moderation"],
    ),
  })

  const mutateAppOfTheDay = useMutation({
    mutationKey: ["app-of-the-day", "monday"],
    mutationFn: async (app: { id: string; day: Date }) => {
      await setAppOfTheDayAppPicksAppOfTheDayPost(
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
        <AppOfTheDay appOfTheDay={queryAppOfTheDay.data as DesktopAppstream} />
      )}
      <FlathubCombobox
        disabled={isBefore(day, new Date()) && !isSameDay(day, new Date())}
        items={selectableApps}
        selectedItem={queryAppOfTheDay.data ?? null}
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
  item: {
    id: string
    name: string
    subtitle?: string
    icon?: string
    lastTimeAppOfTheDay?: UTCDate
    numberOfTimesAppOfTheDay?: number
  }
}): ReactElement => {
  return (
    <div className="flex gap-2 items-center cursor-pointer">
      <LogoImage iconUrl={item.icon} appName={item.name} size="24" />
      <div className="flex flex-col w-full pe-4">
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
        {item.numberOfTimesAppOfTheDay > 0 && (
          <span
            className={clsx(
              "flex truncate gap-6 text-sm opacity-70 justify-between",
            )}
          >
            Last picked
            <strong>
              {formatDistanceToNow(item.lastTimeAppOfTheDay, {
                addSuffix: true,
              })}
            </strong>
          </span>
        )}
        {item.numberOfTimesAppOfTheDay > 0 && (
          <span
            className={clsx(
              "flex truncate gap-6 text-sm opacity-70 justify-between",
            )}
          >
            Times picked <strong>{item.numberOfTimesAppOfTheDay}</strong>
          </span>
        )}
        {selected && (
          <span
            className={clsx(
              "absolute inset-y-0 end-0 flex items-center pe-4",
              active ? "text-white" : "text-flathub-bg-flathub-celestial-blue",
            )}
          >
            <CheckIcon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  )
}
