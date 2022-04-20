import { forwardRef, FunctionComponent } from 'react'
import styles from './Button.module.scss'

interface Props {
  children: React.ReactNode
  onClick?: (e: any) => void
  type?: 'primary' | 'secondary'
  buttonType?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}

const Button: FunctionComponent<Props> = forwardRef<HTMLButtonElement, Props>(
  ({ children, onClick, type, buttonType, disabled = false, className }, ref) => {
    return (
      <button
        className={
          (type === 'secondary'
            ? styles.secondaryButton
            : styles.primaryButton) +
            ' ' +
            className ?? ''
        }
        onClick={onClick}
        ref={ref}
        type={buttonType}
        disabled={disabled}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
