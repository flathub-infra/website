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
        className={`flex items-center justify-center break-words rounded-xl bg-flathubWhite dark:bg-flathubJet p-3 text-center text-flathubNickel dark:text-flathubDarkGray no-underline shadow-md duration-500 hover:bg-flathubGray98 hover:dark:bg-flathubRaisinBlack  ${className}`}
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
