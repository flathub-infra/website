import { FunctionComponent, forwardRef } from "react"

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
        className={`flex items-center justify-center break-words rounded-xl bg-flathubWhite p-3 text-center text-flathubNickel no-underline shadow-md duration-500 hover:bg-flathubGray98 dark:bg-flathubJet dark:text-flathubDarkGray hover:dark:bg-flathubRaisinBlack  ${className}`}
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
