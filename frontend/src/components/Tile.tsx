import { FunctionComponent, forwardRef } from 'react'
import styles from './Tile.module.scss'

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
        className={`${styles.tile} ${className}`}
        href={href}
        onClick={onClick}
        ref={ref}
      >
        {children}
      </a>
    )
  }
)

Tile.displayName = 'Tile'

export default Tile
