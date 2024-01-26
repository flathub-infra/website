import clsx from "clsx"
import { FunctionComponent } from "react"
import { HiStar } from "react-icons/hi2";

interface Props {
  rating: number
}

const AppRating: FunctionComponent<Props> = ({ rating }) => {
  return (
    <div className="flex flex-row gap-1 items-center">
      <HiStar className="text-yellow-400"></HiStar>
      {rating.toFixed(1)}
    </div>
  )
}

export default AppRating
