import { Summary } from "../../types/Summary"
import ListBox from "./ListBox"
import styles from "./AdditionalInfo.module.scss"
import { MdWifi, MdChatBubble, MdDevices } from "react-icons/md"
import { i18n, useTranslation } from "next-i18next"
import { TFunction } from "react-i18next"

const Permissions = ({
  summary,
  appId,
}: {
  summary?: Summary
  appId: string
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.additionalInfo}>
      {summary.metadata.permissions.shared.indexOf("network") != -1 && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <MdWifi />,
              header: "Network",
              content: {
                type: "text",
                text: "This App has network access",
              },
            },
          ]}
        ></ListBox>
      )}

      {summary.metadata.permissions.sockets.indexOf("session-bus") != -1 && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <MdChatBubble />,
              header: "Session Bus",
              content: {
                type: "text",
                text: "This App has full access to the entire session bus",
              },
            },
          ]}
        ></ListBox>
      )}

      {summary.metadata.permissions.sockets.indexOf("system-bus") != -1 && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <MdChatBubble />,
              header: "System Bus",
              content: {
                type: "text",
                text: "This App has full access to the entire system bus",
              },
            },
          ]}
        ></ListBox>
      )}

      {summary.metadata.permissions.devices.indexOf("all") != -1 && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <MdDevices />,
              header: "All devices",
              content: {
                type: "text",
                text: "This App has full access to all devices",
              },
            },
          ]}
        ></ListBox>
      )}
    </div>
  )
}

export default Permissions
