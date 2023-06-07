import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { clsx } from "clsx"
import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { HiArrowTopRightOnSquare } from "react-icons/hi2"
import { ConditionalWrapper } from "src/utils/helpers"

interface Props {
  appId?: string
  items: {
    icon: string | JSX.Element
    header: string
    content:
      | { type: "url"; text: string; trackAsEvent: string }
      | { type: "text"; text: string }
  }[]
}

const ListBox: FunctionComponent<Props> = ({ appId, items }) => {
  const { trackEvent } = useMatomo()
  const { t } = useTranslation()

  return (
    <div className="w-full md:w-[calc(50%-4px)] 2xl:w-[calc(25%-6px)]">
      {items &&
        items
          .filter((a) => a)
          .map((item, index) => {
            const linkClicked = () => {
              trackEvent({
                category: "App",
                action:
                  item.content.type === "url" ? item.content.trackAsEvent : "",
                name: appId ?? "unknown",
              })
            }
            return (
              <ConditionalWrapper
                key={index}
                condition={item.content.type === "url"}
                wrapper={(children) => (
                  <a
                    href={item.content.text}
                    target="_blank"
                    rel="noreferrer"
                    onClick={linkClicked}
                    title={t("open-in-new-tab")}
                    className="text-flathub-dark-gunmetal dark:text-flathub-gainsborow"
                  >
                    {children}
                  </a>
                )}
              >
                <div
                  className={clsx(
                    `grid h-full w-full grid-cols-[36px_calc(100%_-_36px_-_36px)_36px] items-center bg-flathub-white p-4 shadow-md first:rounded-tl-xl first:rounded-tr-xl last:rounded-bl-xl last:rounded-br-xl dark:bg-flathub-arsenic`,
                    item.content.type === "text" &&
                      "grid-cols-[36px_calc(100%_-_36px)]",
                    item.content.type === "url" &&
                      "hover:bg-flathub-gainsborow/20 active:bg-flathub-gainsborow/50 dark:hover:bg-flathub-arsenic/80 dark:active:bg-flathub-arsenic/50",
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
                  {item.content.type === "url" && (
                    <div className="self-center justify-self-end opacity-60">
                      <HiArrowTopRightOnSquare />
                    </div>
                  )}
                </div>
              </ConditionalWrapper>
            )
          })}
    </div>
  )
}

export default ListBox
