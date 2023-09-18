import { clsx } from "clsx"
import { LayoutGroup, motion } from "framer-motion"
import { ReactNode } from "react"

const MultiToggle = ({
  items,
}: {
  items: {
    id: string
    content: ReactNode
    onClick: () => void
    selected: boolean
    disabled?: boolean
  }[]
}) => {
  return (
    <LayoutGroup id={Math.random().toString(36)}>
      <ul className="flex w-full cursor-pointer justify-around rounded-xl border border-flathub-gray-x11 dark:border-flathub-lotion/10 py-1 text-center">
        {items.map((item) => (
          <div key={item.id} className="relative z-10 mx-1 w-full">
            <button
              type="button" // If this isn't set to button, the button will submit the form
              onClick={item.onClick}
              disabled={item.disabled}
              className={clsx(
                item.selected
                  ? "text-flathub-white"
                  : "enabled:text-flathub-gainsborow enabled:hover:bg-flathub-spanish-gray enabled:hover:text-flathub-gainsborow enabled:dark:text-flathub-lotion enabled:dark:hover:bg-flathub-granite-gray enabled:dark:hover:text-flathub-lotion",
                item.disabled &&
                  "cursor-not-allowed text-flathub-gainsborow dark:text-flathub-arsenic",
                "h-full w-full rounded-lg transition",
                "enabled:active:bg-flathub-pastel-pastel-grapefruit dark:enabled:active:bg-flathub-black",
              )}
            >
              <li>{item.content}</li>
            </button>
            {item.selected ? (
              <motion.div
                className="absolute top-0 -z-10 h-full w-full rounded-lg bg-flathub-celestial-blue"
                layoutId="tab"
                layout="position"
              />
            ) : null}
          </div>
        ))}
      </ul>
    </LayoutGroup>
  )
}

export default MultiToggle
