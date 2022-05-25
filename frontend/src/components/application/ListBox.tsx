import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { MdOpenInNew } from "react-icons/md"
import styles from "./ListBox.module.scss"

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
    <div className={styles.list}>
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
              <div
                className={`${styles.item} ${
                  item.content.type === "text" ? styles.noLink : ""
                }`}
                key={index}
              >
                <div className={styles.icon}>{item.icon}</div>
                <div className={styles.details}>
                  {item.header}
                  {item.content.type === "text" && (
                    <span className={styles.content}>{item.content.text}</span>
                  )}
                  {item.content.type === "url" && (
                    <a
                      href={item.content.text}
                      target="_blank"
                      rel="noreferrer"
                      onClick={linkClicked}
                    >
                      {item.content.text}
                    </a>
                  )}
                </div>
                {item.content.type === "url" && (
                  <div className={styles.externalLink}>
                    <a
                      href={item.content.text}
                      target="_blank"
                      rel="noreferrer"
                      onClick={linkClicked}
                      title={t("open-in-new-tab")}
                    >
                      <MdOpenInNew />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )
}

export default ListBox
