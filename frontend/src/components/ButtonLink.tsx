import Link from "next/link"
import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"
import { classNames } from "src/styling"

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
      destructive:
        "hover:bg-flathub-electric-red hover:text-gray-100 active:opacity-50",
      secondary: "hover:opacity-75  active:opacity-50",
      primary: "hover:opacity-75 active:opacity-50",
    }[variant]

    const variantClass = {
      destructive:
        "bg-flathub-white dark:bg-flathub-arsenic text-flathub-electric-red border border-flathub-electric-red",
      secondary:
        "bg-flathub-gainsborow dark:bg-flathub-granite-gray text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
      primary:
        "bg-flathub-celestial-blue dark:bg-flathub-celestial-blue text-gray-100",
    }[variant]

    return (
      <Link
        href={href}
        passHref={passHref}
        {...rest}
        onClick={onClick}
        target={target}
        ref={ref}
        rel={rel}
        className={classNames(
          className ?? "",
          hover,
          variantClass,
          "no-wrap flex h-11 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center font-bold no-underline duration-500 hover:cursor-pointer",
        )}
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
