import Link from "next/link"
import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"

type Props = {
  href
  passHref
  target?
  rel?
  onClick?
  children: React.ReactNode
  "aria-label"?: string
  variant?: "primary" | "secondary" | "destructive"
} & DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLAnchorElement>,
  HTMLAnchorElement
>

const ButtonLink: FunctionComponent<Props> = forwardRef<
  HTMLAnchorElement,
  Props
>(
  (
    {
      href,
      passHref,
      target,
      rel,
      onClick,
      children,
      "aria-label": ariaLabel,
      variant = "primary",
      className,
      ...rest
    },
    ref,
  ) => {
    const hover = {
      destructive: "hover:bg-flathubElectricRed hover:text-gray-100",
      secondary: "hover:opacity-75",
      primary: "hover:opacity-75",
    }[variant]

    const variantClass = {
      destructive:
        "bg-flathubWhite dark:bg-flathubJet text-flathubElectricRed border border-flathubElectricRed",
      secondary: "bg-flathubGray92 dark:bg-flathubOuterSpace text-flathubGunmetal  dark:text-flathubGray98",
      primary: "bg-flathubCyanBlueAzure dark:bg-flathubIndigo text-gray-100",
    }[variant]

    return (
      // @ts-ignore
      <Link
        href={href}
        passHref={passHref}
        {...rest}
        onClick={onClick}
        target={target}
        rel={rel}
        tabIndex={-1}
        className={`${className ?? ""
          }  ${hover} ${variantClass} no-wrap flex h-11 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center font-bold no-underline duration-500 hover:cursor-pointer active:bg-flathubGray98/100 active:dark:bg-flathubRaisinBlack/100`}
        aria-label={ariaLabel}
        role="button"
      >
        {children}
      </Link>
    )
  },
)

ButtonLink.displayName = "ButtonLink"

export default ButtonLink
