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
        className={`flex items-center justify-center break-words rounded-xl bg-flathub-white p-3 text-center text-flathub-sonic-silver no-underline shadow-md duration-500 hover:bg-flathub-gainsborow dark:bg-flathub-arsenic dark:text-flathub-spanish-gray hover:dark:bg-flathub-dark-gunmetal  ${className}`}
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
