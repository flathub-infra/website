import Link from "next/link"
import {
  forwardRef,
  FunctionComponent,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react"
import { clsx } from "clsx"
import { cn } from "@/lib/utils"

type Props = {
  href
  passHref
  target?
  rel?
  onClick?
  children: React.ReactNode
  "aria-label"?: string
  variant?: "primary" | "secondary" | "destructive"
  disabled?: boolean
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
      disabled,
      ...rest
    },
    ref,
  ) => {
    const hover = {
      destructive: !disabled && "hover:opacity-75 active:opacity-50",
      secondary: !disabled && "hover:opacity-75 active:opacity-50",
      primary: !disabled && "hover:opacity-75 active:opacity-50",
    }[variant]

    const variantClass = {
      destructive: clsx(
        !disabled &&
          "bg-flathub-vivid-crimson dark:bg-flathub-dark-candy-apple-red",
        "text-flathub-lotion",
      ),
      secondary: clsx(
        "bg-flathub-gainsborow dark:bg-flathub-granite-gray",
        "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
        disabled && "text-flathub-lotion",
      ),
      primary:
        "bg-flathub-celestial-blue dark:bg-flathub-celestial-blue text-flathub-lotion",
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
        className={cn(
          hover,
          variantClass,
          "no-wrap flex gap-1 h-11 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center font-bold no-underline duration-500",
          disabled
            ? "dark:bg-flathub-sonic-silver bg-flathub-sonic-silver cursor-not-allowed opacity-70"
            : "hover:cursor-pointer",
          className,
        )}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        role="button"
      >
        {children}
      </Link>
    )
  },
)

ButtonLink.displayName = "ButtonLink"

export default ButtonLink
