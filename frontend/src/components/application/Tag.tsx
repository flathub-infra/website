import clsx from "clsx"
import { FunctionComponent } from "react"

interface Props {
  text: string
  inACard?: boolean
}

const Tag: FunctionComponent<Props> = ({ text, inACard }) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        inACard
          ? "bg-flathub-lotion text-flathub-dark-gunmetal dark:bg-flathub-granite-gray dark:text-flathub-lotion"
          : "bg-flathub-gainsborow text-flathub-dark-gunmetal dark:bg-flathub-granite-gray dark:text-flathub-lotion",
      )}
    >
      {text}
    </span>
  )
}

export default Tag
