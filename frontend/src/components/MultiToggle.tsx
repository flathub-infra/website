import { clsx } from "clsx"
import { LayoutGroup, motion } from "framer-motion"
import {
  DetailedHTMLProps,
  FunctionComponent,
  HTMLAttributes,
  ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import FlathubListbox from "./FlathubListbox"

const MultiToggleBig = ({
  items,
  variant = "primary",
  size = "sm",
  layoutId = "tab",
}) => {
  const layoutGroupId = `multi-toggle-${variant}-${size}`
  const motionLayoutId = layoutId

  return (
    <LayoutGroup id={layoutGroupId}>
      <ul
        className={clsx(
          size === "sm" ? "flex" : "hidden md:flex",
          "w-full cursor-pointer justify-around rounded-full overflow-visible",
          variant === "primary" &&
            "border border-flathub-gray-x11 dark:border-flathub-lotion/10",
          variant === "secondary" &&
            "bg-flathub-gainsborow dark:bg-flathub-arsenic",
          variant === "flat" && "dark:bg-flathub-white/15 bg-flathub-black/10",
          "py-1 text-center",
          size === "sm" ? "h-[34px]" : "h-14",
        )}
      >
        {items.map((item) => (
          <li
            key={item.id}
            className="relative z-10 mx-1 w-full truncate overflow-visible"
          >
            <button
              type="button" // If this isn't set to button, the button will submit the form
              onClick={item.onClick}
              disabled={item.disabled}
              className={clsx(
                item.selected && variant === "primary" && "text-flathub-white",
                item.selected &&
                  variant === "secondary" &&
                  "text-flathub-black dark:text-flathub-white",
                item.selected &&
                  variant === "flat" &&
                  "text-flathub-black dark:text-flathub-white",

                !item.selected &&
                  variant === "primary" &&
                  "enabled:text-flathub-arsenic enabled:hover:bg-flathub-gray-x11 enabled:hover:text-flathub-white",
                !item.selected &&
                  variant === "secondary" &&
                  "enabled:text-flathub-arsenic enabled:hover:bg-flathub-white/50",
                !item.selected &&
                  variant === "flat" &&
                  "enabled:text-flathub-arsenic enabled:hover:bg-flathub-white/50",
                !item.selected &&
                  "dark:enabled:text-flathub-lotion dark:enabled:hover:bg-flathub-white/10 dark:enabled:hover:text-flathub-lotion",

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
                layoutId={motionLayoutId}
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
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
  variant?: "primary" | "secondary" | "flat"
  layoutId?: string
} & DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>

const MultiToggle: FunctionComponent<Props> = ({
  ref,
  items,
  size = "lg",
  variant = "primary",
  layoutId,
}: Props & {
  ref: React.RefObject<HTMLUListElement>
}) => {
  return (
    <>
      <FlathubListbox
        items={items}
        className={clsx(size === "sm" ? "hidden" : "md:hidden", "w-full")}
      />
      <MultiToggleBig
        items={items}
        variant={variant}
        size={size}
        layoutId={layoutId}
      />
    </>
  )
}

MultiToggle.displayName = "MultiToggle"

export default MultiToggle
