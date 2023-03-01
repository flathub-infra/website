import { FunctionComponent, forwardRef } from "react"
import { classNames } from "src/styling"

interface Props {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  href?: string
}

const Tile: FunctionComponent<Props> = forwardRef<HTMLAnchorElement, Props>(
  ({ children, className, onClick, href }, ref) => {
    return (
      <a
        className={classNames(
          "flex items-center justify-center break-words rounded-xl p-3 text-center duration-500",
          "bg-flathub-white text-flathub-sonic-silver shadow-md dark:bg-flathub-arsenic dark:text-flathub-spanish-gray",
          "hover:bg-flathub-gainsborow/5 hover:no-underline hover:shadow-xl dark:hover:bg-flathub-granite-gray",
          "active:bg-flathub-gray-x11 active:dark:bg-flathub-dark-gunmetal",
          className,
        )}
        href={href}
        onClick={onClick}
        ref={ref}
      >
        <span className="overflow-hidden">{children}</span>
      </a>
    )
  },
)

Tile.displayName = "Tile"

export default Tile
