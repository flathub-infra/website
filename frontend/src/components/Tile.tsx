import { FunctionComponent } from "react"
import { cn } from "@/lib/utils"

interface Props {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  href?: string
}

const Tile: FunctionComponent<Props> = ({
  ref,
  children,
  className,
  onClick,
  href,
}: Props & {
  ref: React.RefObject<HTMLAnchorElement>
}) => {
  return (
    <a
      className={cn(
        "flex items-center justify-center break-words rounded-xl p-4 text-center duration-500",
        "bg-flathub-white text-flathub-sonic-silver shadow-md dark:bg-flathub-arsenic/70 dark:text-flathub-spanish-gray",
        "hover:bg-flathub-gainsborow/20 hover:no-underline hover:shadow-xl dark:hover:bg-flathub-arsenic/90 hover:cursor-pointer",
        "active:bg-flathub-gainsborow/40 active:shadow-xs dark:active:bg-flathub-arsenic",
        className,
      )}
      href={href}
      onClick={onClick}
      ref={ref}
    >
      <span className="overflow-hidden">{children}</span>
    </a>
  )
}

Tile.displayName = "Tile"

export default Tile
