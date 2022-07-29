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
        "bg-bgColorSecondary text-colorDanger border border-colorDanger disabled:borden-none disabled:text-gray-100 hover:bg-colorDanger hover:text-gray-100",
      secondary:
        "bg-bgColorSecondary text-colorSecondary border border-colorSecondary disabled:border-none disabled:text-gray-100 disabled:bg-gray-500 hover:bg-colorPrimary hover:text-gray-100",
      primary:
        "bg-colorPrimary text-gray-100 disabled:bg-gray-400 hover:bg-colorSecondary",
    }[variant]

    return (
      <button
        className={`${
          className ?? ""
        } ${variantClass} no-wrap h-12 overflow-hidden text-ellipsis whitespace-nowrap px-5 py-2 text-center duration-500 hover:cursor-pointer active:bg-bgColorPrimary active:text-colorPrimary disabled:cursor-default`}
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
