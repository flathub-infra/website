import Link from "next/link"
import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"
import { VerificationStatus } from "src/types/VerificationStatus"
import { VerificationProvider } from "src/verificationProvider"
import VerificationIcon from "./VerificationIcon"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { cva, VariantProps } from "class-variance-authority"
import React from "react"

const cardVariants = cva(
  "flex min-w-0 items-center gap-4 duration-500 hover:cursor-pointer hover:no-underline active:bg-flathub-gainsborow/40 active:dark:bg-flathub-arsenic h-full",
  {
    variants: {
      variant: {
        default:
          "bg-flathub-white dark:bg-flathub-arsenic rounded-xl shadow-md hover:bg-flathub-lotion dark:hover:bg-flathub-arsenic/90",
        nested:
          "bg-flathub-gainsborow/40 dark:bg-flathub-gainsborow/10 rounded-lg shadow-md hover:bg-flathub-gainsborow/20 dark:hover:bg-flathub-gainsborow/20",
        flat: "rounded-xl hover:bg-flathub-white/50 active:bg-flathub-white/80 dark:hover:bg-flathub-gainsborow/10 dark:active:bg-flathub-gainsborow/30",
      },
      size: {
        default: "p-4",
        sm: "p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  className?: string
}

export const ApplicationCardSkeleton = React.forwardRef<
  HTMLDivElement,
  SkeletonProps
>(({ className, variant, size, ...props }, ref) => {
  return (
    <Skeleton
      className={cn(cardVariants({ variant, size }), "h-32", className)}
      {...props}
    />
  )
})

ApplicationCardSkeleton.displayName = "ApplicationCardSkeleton"

export interface Props
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof cardVariants> {
  application: AppstreamListItem
  link?: (appid: string) => string
  showId?: boolean
  className?: string
}

export const ApplicationCard = React.forwardRef<HTMLAnchorElement, Props>(
  (
    { className, variant, size, application, link, showId = false, ...props },
    ref,
  ) => {
    const isVerified = application.metadata?.["flathub::verification::verified"]

    const linkFunc = link ?? ((appid: string) => `/apps/${appid}`)

    const verificationStatus: VerificationStatus =
      isVerified &&
      application.metadata?.["flathub::verification::method"] !== "none"
        ? {
            method: application.metadata?.["flathub::verification::method"],
            verified: true,
            website: application.metadata?.["flathub::verification::website"],
            login_provider: application.metadata?.[
              "flathub::verification::login_provider"
            ] as VerificationProvider,
            login_name:
              application.metadata?.["flathub::verification::login_name"],
            login_is_organization:
              application.metadata?.[
                "flathub::verification::login_is_organization"
              ] === "true",
            timestamp: 0,
            detail: "",
          }
        : {
            method: "none",
            verified: false,
            detail: "",
          }

    return (
      <Link
        href={linkFunc(application.id)}
        passHref
        aria-label={application.name}
        aria-description={application.summary}
        className={cn(cardVariants({ variant, size }), className)}
        {...props}
        ref={ref}
      >
        <div className="relative flex h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[96px] md:w-[96px]">
          <LogoImage iconUrl={application.icon} appName={application.name} />
        </div>
        <div className="flex flex-col justify-center overflow-hidden">
          <div className="flex gap-1">
            <span className="truncate whitespace-nowrap text-base font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
              {application.name}
            </span>
            <VerificationIcon
              appId={application.id}
              verificationStatus={verificationStatus}
            />
          </div>
          {showId && application.id !== application.name && (
            <div className="text-sm text-flathub-spanish-gray truncate leading-none">
              {application.id}
            </div>
          )}
          <div className="mt-1 line-clamp-2 text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow md:line-clamp-3">
            {application.summary}
          </div>
        </div>
      </Link>
    )
  },
)

ApplicationCard.displayName = "ApplicationCard"
