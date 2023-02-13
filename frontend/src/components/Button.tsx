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
        "bg-flathubWhite dark:bg-flathubJet text-flathubElectricRed border border-flathubElectricRed disabled:borden-none disabled:text-gray-100 enabled:hover:bg-flathubElectricRed enabled:hover:text-gray-100",
      secondary:
        "bg-flathubGray92 dark:bg-flathubOuterSpace text-flathubGunmetal  dark:text-flathubGray98 disabled:border-none disabled:text-gray-100 disabled:bg-gray-500 enabled:hover:opacity-60",
      primary:
        "bg-flathubCyanBlueAzure dark:bg-flathubIndigo text-gray-100 disabled:bg-gray-400 enabled:hover:opacity-75",
    }[variant]

    return (
      <button
        className={`${className ?? ""
          } ${variantClass} no-wrap h-11 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center duration-500 enabled:hover:cursor-pointer enabled:active:bg-flathubGray98 active:dark:bg-flathubRaisinBlack enabled:active:text-flathubCyanBlueAzure dark:enabled:active:text-flathubIndigo disabled:cursor-default`}
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
