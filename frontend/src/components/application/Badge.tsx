import { FunctionComponent } from "react"

interface Props {
  text: string
}

const Tags: FunctionComponent<Props> = ({ text }) => {
  return (
    <span className="inline-flex items-center rounded-full bg-flathub-gainsborow px-1.5 py-0.5 text-xs font-medium text-flathub-sonic-silver dark:bg-flathub-arsenic dark:text-flathub-spanish-gray">
      {text}
    </span>
  )
}

export default Tags
