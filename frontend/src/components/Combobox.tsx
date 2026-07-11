import { useState } from "react"
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from "@headlessui/react"
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid"
import clsx from "clsx"

export const FlathubCombobox = <
  T extends { id: string | number; name: string; subtitle?: string },
>({
  items,
  selectedItem,
  setSelectedItem,
  label,
  placeholder,
  disabled,
  renderItem,
  variant = "default",
}: {
  items: T[]
  selectedItem: T | null
  setSelectedItem: (item: T | null) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  variant?: "default" | "form"
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
        <Label
          className={clsx(
            "block text-sm leading-6 text-gray-900 dark:text-flathub-lotion",
            variant === "form" ? "font-semibold" : "font-medium",
          )}
        >
          {label}
        </Label>
      )}
      <div className="relative mt-2">
        <ComboboxInput
          className={clsx(
            variant === "form"
              ? [
                  "h-12 w-full rounded-xl border border-input bg-flathub-gainsborow py-1 ps-3 pe-10",
                  "text-base text-gray-900 shadow-xs transition-colors dark:bg-stone-900 dark:text-flathub-lotion",
                  "focus:outline-hidden focus:ring-2 focus:ring-flathub-celestial-blue",
                  disabled &&
                    "bg-flathub-gainsborow/70 hover:bg-flathub-gainsborow/70 dark:bg-stone-900/70 dark:hover:bg-stone-900/70",
                ]
              : [
                  "w-full rounded-md border-0 bg-flathub-white py-1.5 ps-3 pe-10 dark:bg-flathub-arsenic",
                  "text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 dark:text-flathub-lotion dark:ring-0 focus:ring-2 focus:ring-inset",
                  "focus:ring-flathub-celestial-blue sm:text-sm sm:leading-6",
                  disabled &&
                    "bg-flathub-gainsborow hover:bg-flathub-gainsborow dark:bg-flathub-granite-gray dark:hover:bg-flathub-granite-gray",
                ],
          )}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          displayValue={(item: T) => item?.name}
        />
        <ComboboxButton className="absolute inset-y-0 end-0 flex items-center rounded-r-md px-2 focus:outline-hidden">
          <ChevronUpDownIcon
            className="size-5 text-gray-400"
            aria-hidden="true"
          />
        </ComboboxButton>

        {filtered.length > 0 && (
          <ComboboxOptions
            className={clsx(
              "absolute z-10 mt-1 w-full min-w-min max-h-[540px] overflow-auto py-1 text-base shadow-lg focus:outline-hidden sm:text-sm",
              variant === "form"
                ? "rounded-xl border border-input bg-flathub-white dark:bg-stone-900"
                : "rounded-md bg-flathub-white ring-1 ring-black ring-opacity-5 dark:bg-flathub-arsenic",
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
                            "absolute inset-y-0 end-0 flex items-center pe-4",
                            focus
                              ? "text-white"
                              : "text-flathub-bg-flathub-celestial-blue",
                          )}
                        >
                          <CheckIcon className="size-5" aria-hidden="true" />
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
