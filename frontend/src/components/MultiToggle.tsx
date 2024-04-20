import { Listbox, Transition } from "@headlessui/react"
import { clsx } from "clsx"
import { LayoutGroup, motion } from "framer-motion"
import {
  DetailedHTMLProps,
  Fragment,
  FunctionComponent,
  HTMLAttributes,
  ReactNode,
  forwardRef,
} from "react"
import { HiChevronDown } from "react-icons/hi2"
import { cn } from "src/utils/helpers"

const ListBoxMultiToggle = ({ selectedItem, items }) => {
  return (
    <Listbox
      value={selectedItem}
      onChange={(item) => {
        item.onClick()
      }}
      as={"div"}
      className={clsx("relative", "md:hidden")}
    >
      <Listbox.Button
        className={clsx(
          "bg-flathub-gainsborow dark:bg-flathub-arsenic rounded-full px-4 py-3 font-semibold flex items-center",
          "w-full",
          "flex items-center justify-between gap-2",
        )}
      >
        {selectedItem?.content}
        <HiChevronDown />
      </Listbox.Button>
      <Transition
        as={Fragment}
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Listbox.Options
          className={clsx(
            "bg-flathub-white dark:bg-flathub-arsenic rounded-3xl mt-1",
            "absolute",
            "w-full",
            "z-10",
            "shadow-md",
          )}
        >
          {items.map((item) => (
            <Listbox.Option key={item.id} value={item} as={Fragment}>
              {({ active, selected }) => (
                <div
                  className={clsx(
                    "p-4",
                    "cursor-pointer",
                    selected && "font-semibold",
                    active &&
                      "bg-flathub-gainsborow/40 dark:bg-flathub-gainsborow/10",
                    "first:rounded-t-3xl last:rounded-b-3xl",
                  )}
                >
                  {item.content}
                </div>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </Listbox>
  )
}

const MultiToggleBig = ({ items, variant = "primary", size = "sm" }) => {
  return (
    <LayoutGroup id={Math.random().toString(36)}>
      <ul
        className={clsx(
          "hidden md:flex",
          "w-full cursor-pointer justify-around rounded-full",
          variant === "primary" &&
            "border border-flathub-gray-x11 dark:border-flathub-lotion/10",
          variant === "secondary" &&
            "bg-flathub-gainsborow dark:bg-flathub-arsenic",
          "py-1 text-center",
          size === "sm" ? "h-[34px]" : "h-14",
        )}
      >
        {items.map((item) => (
          <div key={item.id} className="relative z-10 mx-1 w-full truncate">
            <button
              type="button" // If this isn't set to button, the button will submit the form
              onClick={item.onClick}
              disabled={item.disabled}
              className={clsx(
                item.selected
                  ? variant === "primary"
                    ? "text-flathub-white"
                    : "text-flathub-black dark:text-flathub-white"
                  : clsx(
                      "enabled:text-flathub-arsenic enabled:hover:bg-flathub-gray-x11 enabled:hover:text-flathub-white",
                      "enabled:dark:text-flathub-lotion enabled:dark:hover:bg-flathub-granite-gray/40 enabled:dark:hover:text-flathub-lotion",
                    ),
                item.disabled &&
                  "cursor-not-allowed text-flathub-gainsborow dark:text-flathub-arsenic",
                "h-full w-full rounded-full transition",
                size === "lg" && "px-4",
              )}
            >
              <li className="truncate">{item.content}</li>
            </button>
            {item.selected && (
              <motion.div
                className={cn(
                  "absolute top-0 -z-10 h-full w-full rounded-full",
                  variant === "primary"
                    ? "bg-flathub-celestial-blue"
                    : "dark:bg-flathub-gainsborow/20 bg-flathub-white",
                  item.color,
                )}
                layoutId="tab"
                layout="position"
              />
            )}
          </div>
        ))}
      </ul>
    </LayoutGroup>
  )
}

type Props = {
  items: {
    id: string
    content: ReactNode
    onClick: () => void
    selected: boolean
    disabled?: boolean
    color?: string
  }[]
  size: "sm" | "lg"
  variant?: "primary" | "secondary"
} & DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>

const MultiToggle: FunctionComponent<Props> = forwardRef<
  HTMLUListElement,
  Props
>(({ items, size = "lg", variant = "primary" }, ref) => {
  const selectedItem = items.find((item) => item.selected) ?? undefined

  return (
    <>
      <ListBoxMultiToggle items={items} selectedItem={selectedItem} />
      <MultiToggleBig items={items} variant={variant} size={size} />
    </>
  )
})

MultiToggle.displayName = "MultiToggle"

export default MultiToggle
