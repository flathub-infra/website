import { forwardRef, FunctionComponent } from 'react'
import styles from './Button.module.scss'

interface Props {
  children: React.ReactNode
  onClick?: (e: any) => void
  type?: 'primary' | 'secondary'
}

const Button: FunctionComponent<Props> = forwardRef<HTMLButtonElement, Props>(
  ({ children, onClick, type }, ref) => {
    return (
      <button
        className={
          type === 'secondary' ? styles.secondaryButton : styles.primaryButton
        }
        onClick={onClick}
        ref={ref}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
