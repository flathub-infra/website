import { cn } from "@/lib/utils"
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react"
import { clsx } from "clsx"
import {
  DetailedHTMLProps,
  Fragment,
  FunctionComponent,
  HTMLAttributes,
  ReactNode,
} from "react"
import { HiChevronDown } from "react-icons/hi2"

type Props = {
  items: {
    id: string
    content: ReactNode
    onClick: () => void
    selected: boolean
    disabled?: boolean
    color?: string
  }[]
  className?: string
} & DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>

const FlathubListbox: FunctionComponent<Props> = ({
  ref,
  items,
  className,
}: Props & {
  ref: React.RefObject<HTMLUListElement>
}) => {
  const selectedItem = items.find((item) => item.selected) ?? null

  return (
    <Listbox
      value={selectedItem}
      onChange={(item) => {
        item?.onClick()
      }}
      as={"div"}
      className={cn("relative", className)}
    >
      <ListboxButton
        className={clsx(
          "bg-flathub-gainsborow dark:bg-flathub-arsenic rounded-full px-4 py-3 font-semibold flex items-center",
          "w-full",
          "flex items-center justify-between gap-2",
        )}
      >
        {selectedItem?.content}
        <HiChevronDown />
      </ListboxButton>
      <Transition
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <ListboxOptions
          className={clsx(
            "bg-flathub-white dark:bg-flathub-arsenic rounded-3xl mt-1",
            "absolute",
            "w-full",
            "z-10",
            "shadow-md",
          )}
        >
          {items.map((item) => (
            <ListboxOption key={item.id} value={item} as={Fragment}>
              {({ focus, selected }) => (
                <div
                  className={clsx(
                    "p-4",
                    "cursor-pointer",
                    selected && "font-semibold",
                    focus &&
                      "bg-flathub-gainsborow/40 dark:bg-flathub-gainsborow/10",
                    "first:rounded-t-3xl last:rounded-b-3xl",
                  )}
                >
                  {item.content}
                </div>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Transition>
    </Listbox>
  )
}

FlathubListbox.displayName = "FlathubListbox"

export default FlathubListbox
