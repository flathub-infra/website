import { useState } from "react"
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from "@headlessui/react"
import { HiCheck, HiChevronUpDown } from "react-icons/hi2"
import clsx from "clsx"

export const FlathubCombobox = <
  T extends { id: string | number; name: string; subtitle?: string },
>({
  items,
  selectedItem,
  setSelectedItem,
  label,
  disabled,
  renderItem,
}: {
  items: T[]
  selectedItem: T | null
  setSelectedItem: (item: T) => void
  label?: string
  disabled?: boolean
  renderItem?: (
    active: boolean,
    selected: boolean,
    item: T,
  ) => React.ReactElement
}) => {
  const [query, setQuery] = useState("")

  const filtered =
    query === ""
      ? items
      : items.filter((item) => {
          return item.name.toLowerCase().includes(query.toLowerCase())
        })

  return (
    <Combobox
      as="div"
      by={(a, b) => a?.id === b?.id}
      value={selectedItem}
      onChange={setSelectedItem}
      disabled={disabled}
    >
      {label && (
        <Label className="block text-sm font-medium leading-6 text-gray-900">
          {label}
        </Label>
      )}
      <div className="relative mt-2">
        <ComboboxInput
          className={clsx(
            "w-full rounded-md border-0 bg-flathub-white dark:bg-flathub-arsenic py-1.5 ps-3 pe-10",
            "text-gray-900 dark:text-flathub-lotion shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-0 focus:ring-2 focus:ring-inset",
            "focus:ring-flathub-celestial-blue sm:text-sm sm:leading-6",
            disabled && "bg-flathub-gainsborow dark:bg-flathub-granite-gray",
          )}
          onChange={(event) => setQuery(event.target.value)}
          displayValue={(item: T) => item?.name}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden">
          <HiChevronUpDown
            className="size-5 text-gray-400"
            aria-hidden="true"
          />
        </ComboboxButton>

        {filtered.length > 0 && (
          <ComboboxOptions
            className={clsx(
              "absolute z-10 mt-1 w-full min-w-min max-h-[540px] overflow-auto rounded-md bg-flathub-white dark:bg-flathub-arsenic",
              "py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden sm:text-sm",
            )}
          >
            {filtered.map((item) => (
              <ComboboxOption
                key={item.id}
                value={item}
                className={({ focus }) =>
                  clsx(
                    "relative cursor-default select-none py-2 ps-3 pe-9",
                    focus
                      ? "bg-flathub-celestial-blue text-flathub-white"
                      : "text-flathub-dark-gunmetal dark:text-flathub-lotion",
                  )
                }
              >
                {({ focus, selected }) =>
                  renderItem ? (
                    renderItem(focus, selected, item)
                  ) : (
                    <>
                      <span
                        className={clsx(
                          "block truncate",
                          selected && "font-semibold",
                        )}
                      >
                        {item.name}
                      </span>

                      {item.subtitle && (
                        <span
                          className={clsx("block truncate text-sm opacity-70")}
                        >
                          {item.subtitle}
                        </span>
                      )}

                      {selected && (
                        <span
                          className={clsx(
                            "absolute inset-y-0 right-0 flex items-center pe-4",
                            focus
                              ? "text-white"
                              : "text-flathub-bg-flathub-celestial-blue",
                          )}
                        >
                          <HiCheck className="size-5" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )
                }
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </div>
    </Combobox>
  )
}
