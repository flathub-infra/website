import clsx from "clsx"
import { FunctionComponent } from "react"
import { HiStar } from "react-icons/hi2";

interface Props {
  rating: number
}

const AppRating: FunctionComponent<Props> = ({ rating }) => {
  return (
    <div className="flex flex-row gap-1 items-center">
      <HiStar className="text-yellow-400 "></HiStar>
      <span className="text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

export default AppRating
