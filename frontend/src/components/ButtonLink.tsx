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
  disabled?: boolean
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
      disabled,
      "aria-label": ariaLabel,
      variant = "primary",
      className,
      ...rest
    },
    ref,
  ) => {
    const hover = {
      destructive:
        "disabled:borden-none disabled:text-gray-100 enabled:hover:bg-colorDanger enabled:hover:text-gray-100",
      secondary:
        "disabled:border-none disabled:text-gray-100 disabled:bg-gray-500 enabled:hover:opacity-50",
      primary: " disabled:bg-gray-400 enabled:hover:opacity-75",
    }[variant]

    const variantClass = {
      destructive:
        "bg-bgColorSecondary text-colorDanger border border-colorDanger",
      secondary:
        "bg-bgColorSecondary text-textSecondary border border-textSecondary",
      primary: "bg-colorPrimary text-gray-100",
    }[variant]

    return (
      <Link href={href} passHref={passHref}>
        <a {...rest} onClick={onClick} target={target} rel={rel} tabIndex={-1}>
          <button
            aria-label={ariaLabel}
            className={`${
              className ?? ""
            }  ${hover} ${variantClass} no-wrap h-11 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center duration-500 active:bg-bgColorPrimary active:text-colorPrimary enabled:hover:cursor-pointer disabled:cursor-default`}
            disabled={disabled}
          >
            {children}
          </button>
        </a>
      </Link>
    )
  },
)

ButtonLink.displayName = "ButtonLink"

export default ButtonLink
