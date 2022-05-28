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
        className={`flex items-center justify-center break-words rounded-xl bg-bgColorSecondary p-3 text-center text-colorSecondary no-underline shadow-md duration-500 hover:bg-bgColorPrimary  ${className}`}
        href={href}
        onClick={onClick}
        ref={ref}
      >
        {children}
      </a>
    )
  },
)

Tile.displayName = "Tile"

export default Tile
