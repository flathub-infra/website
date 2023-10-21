import clsx from "clsx"
import { FunctionComponent } from "react"

interface Props {
  text: string
  inACard?: boolean
}

const Tags: FunctionComponent<Props> = ({ text, inACard }) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium",
        inACard
          ? "text-flathub-sonic-silver dark:text-flathub-spanish-gray bg-flathub-gainsborow dark:bg-flathub-dark-gunmetal"
          : "text-flathub-sonic-silver dark:bg-flathub-arsenic dark:text-flathub-spanish-gray bg-flathub-gainsborow ",
      )}
    >
      {text}
    </span>
  )
}

export default Tags
