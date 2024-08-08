import { clsx } from "clsx"
import { LayoutGroup, motion } from "framer-motion"
import {
  DetailedHTMLProps,
  FunctionComponent,
  HTMLAttributes,
  ReactNode,
  forwardRef,
} from "react"
import { cn } from "@/lib/utils"
import FlathubListbox from "./FlathubListbox"

const MultiToggleBig = ({ items, variant = "primary", size = "sm" }) => {
  return (
    <LayoutGroup id={Math.random().toString(36)}>
      <ul
        className={clsx(
          size === "sm" ? "flex" : "hidden md:flex",
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
          <li key={item.id} className="relative z-10 mx-1 w-full truncate">
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
                      variant === "primary"
                        ? "enabled:text-flathub-arsenic enabled:hover:bg-flathub-gray-x11 enabled:hover:text-flathub-white"
                        : "enabled:text-flathub-arsenic enabled:hover:bg-flathub-white/50",
                      "enabled:dark:text-flathub-lotion enabled:dark:hover:bg-flathub-granite-gray/40 enabled:dark:hover:text-flathub-lotion",
                    ),
                item.disabled &&
                  "cursor-not-allowed text-flathub-gainsborow dark:text-flathub-arsenic",
                "h-full w-full rounded-full transition",
                size === "lg" && "px-4",
              )}
            >
              <span className="truncate">{item.content}</span>
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
          </li>
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
  return (
    <>
      <FlathubListbox
        items={items}
        className={clsx(size === "sm" ? "hidden" : "md:hidden")}
      />
      <MultiToggleBig items={items} variant={variant} size={size} />
    </>
  )
})

MultiToggle.displayName = "MultiToggle"

export default MultiToggle
