import { clsx } from "clsx"
import { FunctionComponent } from "react"

interface Props {
  inACard?: boolean
  items: {
    icon: string | JSX.Element
    header: string
    content: { type: "text"; text: string }
  }[]
}

const ListBox: FunctionComponent<Props> = ({ inACard, items }) => {
  return (
    <div className="w-full md:w-[calc(50%-4px)] 2xl:w-[calc(25%-6px)]">
      {items &&
        items
          .filter((a) => a)
          .map((item, index) => {
            return (
              <div
                key={index}
                className={clsx(
                  inACard
                    ? "bg-transparent"
                    : "bg-flathub-white dark:bg-flathub-arsenic shadow-md first:rounded-t-xl last:rounded-b-xl",
                  `grid h-full w-full grid-cols-[36px_calc(100%_-_36px_-_36px)_36px] items-center p-4 dark:bg-flathub-arsenic`,
                  item.content.type === "text" &&
                    "grid-cols-[36px_calc(100%_-_36px)]",
                )}
              >
                <div className="self-center text-2xl text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                  {item.icon}
                </div>
                <div className="text-base">
                  {item.header}
                  {
                    <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                      {item.content.text}
                    </span>
                  }
                </div>
              </div>
            )
          })}
    </div>
  )
}

export default ListBox
