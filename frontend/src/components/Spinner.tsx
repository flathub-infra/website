import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"

interface Props {
  size: "s" | "m" | "l"
  text?: string // Message to display underneath
}

const Spinner: FunctionComponent<Props> = ({ size, text = undefined }) => {
  const { t } = useTranslation()
  if (!text) {
    text = t("loading")
  }

  let spinnerSize = "p-24"
  let widthAndHeight = "200px"

  switch (size) {
    case "s":
      spinnerSize = "p-4"
      widthAndHeight = "30px"
      break
    case "m":
      spinnerSize = "p-12"
      widthAndHeight = "100px"
      break
  }

  // SVG of a circle with a highlighted 90 degree arc on the border
  // Made to spin via CSS animation
  return (
    // Spinner will always be centered and padded relative to its size
    <div className={`flex flex-col items-center ${spinnerSize}`}>
      <svg
        className="animate-spin"
        width={widthAndHeight}
        height={widthAndHeight}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="50" className="fill-bgColorSecondary" />
        <path
          className="fill-colorPrimary"
          d="M50,50l0,50a50,50 0 0 1 -50,-50z"
        />
        <circle cx="50" cy="50" r="45" className="fill-bgColorPrimary" />
      </svg>
      {text ? <p>{text}</p> : <></>}
    </div>
  )
}

export default Spinner
