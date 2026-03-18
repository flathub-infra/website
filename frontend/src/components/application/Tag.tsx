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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        inACard
          ? "bg-flathub-lotion text-flathub-dark-gunmetal dark:bg-flathub-granite-gray dark:text-flathub-lotion"
          : "bg-flathub-gainsborow/70 text-flathub-dark-gunmetal hover:bg-flathub-gainsborow dark:bg-flathub-granite-gray/70 dark:text-flathub-lotion dark:hover:bg-flathub-granite-gray",
      )}
    >
      {text}
    </span>
  )
}

export default Tag
