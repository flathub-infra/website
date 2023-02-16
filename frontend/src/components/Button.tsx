import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"

type Props = {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "destructive"
} & DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

const Button: FunctionComponent<Props> = forwardRef<HTMLButtonElement, Props>(
  ({ children, variant = "primary", className, ...buttonProps }, ref) => {
    const variantClass = {
      destructive:
        "bg-flathub-white dark:bg-flathub-jet text-flathub-electric-red border border-flathub-electric-red disabled:borden-none disabled:text-gray-100 enabled:hover:bg-flathub-electric-red enabled:hover:text-gray-100",
      secondary:
        "bg-flathub-gray-92 dark:bg-flathub-outer-space text-flathub-gunmetal  dark:text-flathub-gray-98 disabled:border-none disabled:text-gray-100 disabled:bg-gray-500 enabled:hover:opacity-60",
      primary:
        "bg-flathub-cyan-blue-azure dark:bg-flathub-indigo text-gray-100 disabled:bg-gray-400 enabled:hover:opacity-75",
    }[variant]

    return (
      <button
        className={`${
          className ?? ""
        } ${variantClass} no-wrap h-11 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center duration-500 enabled:hover:cursor-pointer enabled:active:bg-flathub-gray-98 enabled:active:text-flathub-cyan-blue-azure disabled:cursor-default active:dark:bg-flathub-raisin-black dark:enabled:active:text-flathub-indigo`}
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
