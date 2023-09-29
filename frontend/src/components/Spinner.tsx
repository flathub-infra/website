import clsx from "clsx"
import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"

interface Props {
  size: "s" | "m" | "l"
  text?: string // Message to display underneath
  orientation?: "col" | "row"
}

const Spinner: FunctionComponent<Props> = ({
  size,
  text = undefined,
  orientation = "col",
}) => {
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
    <div
      className={clsx(
        `flex items-center gap-1`,
        spinnerSize,
        orientation === "col" ? "flex-col" : "flex-row",
      )}
    >
      <svg
        width={widthAndHeight}
        height={widthAndHeight}
        viewBox="12 12 76 76"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="fill-flathub-celestial-blue dark:fill-flathub-celestial-blue"
          d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            dur="1s"
            from="0 50 50"
            to="360 50 50"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      {text ? <div>{text}</div> : <></>}
    </div>
  )
}

export default Spinner
