import { FunctionComponent } from "react"
import React from "react"
import { IconType } from "react-icons/lib"

interface Props {
  icon: IconType
  headline: string
  message: string
  type: "warning"
}

const Alert: FunctionComponent<Props> = ({ icon, headline, message, type }) => {
  let iconColor = "text-flathub-arsenic dark:text-flathub-gainsborow"
  let bgColor = "dark:bg-flathub-arsenic bg-flathub-gainsborow/50"
  let headerColor = "text-flathub-black/90 dark:text-flathub-white/90"
  let messageColor = "text-flathub-granite-gray dark:text-flathub-spanish-gray"

  return (
    <>
      <div className={`rounded-xl ${bgColor} p-4`}>
        <div className="flex">
          <div className="flex-shrink-0">
            {React.createElement(icon, {
              className: `h-5 w-5 ${iconColor}`,
              "aria-hidden": "true",
            })}
          </div>
          <div className="ms-3">
            <h3 className={`text-sm font-medium ${headerColor}`}>{headline}</h3>
            <div className={`mt-2 text-sm ${messageColor}`}>
              <p className="text-inherit">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Alert
