import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"
import { clsx } from "clsx"
import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "destructive"
} & DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

const Button: FunctionComponent<Props> = forwardRef<HTMLButtonElement, Props>(
  ({ children, variant = "primary", className, ...buttonProps }, ref) => {
    return (
      <button
        className={cn(
          {
            destructive:
              "bg-flathub-vivid-crimson dark:bg-flathub-dark-candy-apple-red text-flathub-lotion enabled:hover:opacity-75 enabled:active:opacity-50",
            secondary: clsx(
              "bg-flathub-gainsborow dark:bg-flathub-granite-gray",
              "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
              "enabled:hover:opacity-75 enabled:active:opacity-50",
              "disabled:text-flathub-lotion",
            ),
            primary:
              "bg-flathub-celestial-blue dark:bg-flathub-celestial-blue text-flathub-lotion enabled:hover:opacity-75 enabled:active:opacity-50",
          }[variant],
          "no-wrap flex gap-1 items-center justify-center h-11 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center font-bold duration-500 enabled:hover:cursor-pointer dark:disabled:bg-flathub-sonic-silver disabled:bg-flathub-sonic-silver disabled:cursor-not-allowed disabled:opacity-70",
          className,
        )}
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
