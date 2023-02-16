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
        className={`flex items-center justify-center break-words rounded-xl bg-flathub-white p-3 text-center text-flathub-nickel no-underline shadow-md duration-500 hover:bg-flathub-gray-98 dark:bg-flathub-jet dark:text-flathub-dark-gray hover:dark:bg-flathub-raisin-black  ${className}`}
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
