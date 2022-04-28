import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"
import styles from "./Button.module.scss"

type Props = {
  children: React.ReactNode
  variant?: "primary" | "secondary"
} & DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

const Button: FunctionComponent<Props> = forwardRef<HTMLButtonElement, Props>(
  ({ children, variant, className, ...buttonProps }, ref) => {
    return (
      <button
        className={
          (variant === "secondary"
            ? styles.secondaryButton
            : styles.primaryButton) +
            " " +
            className ?? ""
        }
        type={buttonProps.type}
        ref={ref}
        {...buttonProps}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"

export default Button
