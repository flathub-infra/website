import LogoImage from "../LogoImage"

import { AppstreamListItem } from "../../types/Appstream"
import VerificationIcon from "./VerificationIcon"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { cva, VariantProps } from "class-variance-authority"
import React from "react"
import { Link } from "src/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  GetVerificationStatusVerificationAppIdStatusGet200,
  LoginProvider,
} from "src/codegen"

const cardVariants = cva(
  "flex min-w-0 items-center gap-4 duration-500 hover:cursor-pointer hover:no-underline active:bg-flathub-gainsborow/40 dark:active:bg-flathub-arsenic h-full",
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

export const ApplicationCardSkeleton = ({
  className,
  variant,
  size,
  ...props
}: SkeletonProps) => {
  return (
    <div className={cn(cardVariants({ variant, size }), className)} {...props}>
      <div className="relative flex h-[64px] w-[64px] shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[96px] md:w-[96px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
      <div className="flex flex-col justify-center overflow-hidden flex-1">
        <div className="flex gap-1 items-center">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mt-1 space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2 hidden md:block" />
        </div>
      </div>
    </div>
  )
}

ApplicationCardSkeleton.displayName = "ApplicationCardSkeleton"

export interface Props
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof cardVariants> {
  application: AppstreamListItem
  link?: (appid: string) => string
  showId?: boolean
  showRuntime?: boolean
  className?: string
}

export const ApplicationCard = ({
  className,
  variant,
  size,
  application,
  link,
  showId = false,
  showRuntime = false,
  ...props
}: Props) => {
  const t = useTranslations()

  const isVerified = application.metadata?.["flathub::verification::verified"]

  const linkFunc = link ?? ((appid: string) => `/apps/${appid}`)

  const verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200 =
    isVerified &&
    application.metadata?.["flathub::verification::method"] !== "none"
      ? {
          method: application.metadata?.["flathub::verification::method"],
          verified: true,
          website: application.metadata?.["flathub::verification::website"],
          login_provider: application.metadata?.[
            "flathub::verification::login_provider"
          ] as LoginProvider,
          login_name:
            application.metadata?.["flathub::verification::login_name"],
          login_is_organization:
            application.metadata?.[
              "flathub::verification::login_is_organization"
            ] === true,
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
    >
      <div className="relative flex h-[64px] w-[64px] shrink-0 flex-wrap items-center justify-center drop-shadow-md md:h-[96px] md:w-[96px]">
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
          <div className="text-sm dark:text-flathub-spanish-gray text-flathub-granite-gray truncate leading-tight">
            {application.id}
          </div>
        )}
        <div className="mt-1 line-clamp-2 text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow md:line-clamp-3">
          {application.summary}
        </div>
        {showRuntime && application.bundle?.runtime && (
          <div className="mt-1 text-xs dark:text-flathub-spanish-gray text-flathub-granite-gray">
            {t("developer-portal.runtime-version", {
              version: application.bundle.runtime,
            })}
          </div>
        )}
      </div>
    </Link>
  )
}

ApplicationCard.displayName = "ApplicationCard"
