import { UseQueryResult, useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { AxiosResponse } from "axios"
import {
  HiArrowTopRightOnSquare,
  HiArrowsPointingOut,
  HiCheck,
  HiCheckCircle,
  HiChevronUp,
  HiExclamationTriangle,
  HiMiniWindow,
  HiQuestionMarkCircle,
  HiXMark,
} from "react-icons/hi2"
import MultiToggle from "../MultiToggle"
import SlideOver from "../SlideOver"
import LogoImage from "../LogoImage"
import { useCollapse } from "@collapsed/react"
import Button from "../Button"
import { IconGrid } from "./IconGrid"
import { useTranslation } from "next-i18next"
import {
  useFloating,
  autoPlacement,
  offset,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react"
import { Branding, DesktopAppstream } from "src/types/Appstream"
import { formatDistanceToNow, isFuture } from "date-fns"
import { chooseBrandingColor, getContrastColor } from "src/utils/helpers"
import {
  Guideline,
  QualityModerationResponse,
  QualityModerationType,
} from "src/codegen/model"
import {
  deleteReviewRequestForAppQualityModerationAppIdRequestReviewDelete,
  getQualityModerationForAppQualityModerationAppIdGet,
  setFullscreenAppQualityModerationAppIdFullscreenPost,
  setQualityModerationForAppQualityModerationAppIdPost,
} from "src/codegen"

const ShowIconButton = ({ app }: { app: DesktopAppstream }) => {
  const { t } = useTranslation()
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()

  return (
    <div>
      <Button
        variant="secondary"
        className="flex items-center gap-1"
        {...getToggleProps()}
      >
        <span>
          {t(
            isExpanded
              ? "quality-guideline.hide-icon"
              : "quality-guideline.show-icon",
          )}
        </span>
        <HiChevronUp
          className={clsx(
            "transition",
            !isExpanded ? "transform rotate-180" : "",
          )}
        />
      </Button>
      <section {...getCollapseProps()}>
        <div className="flex">
          <div
            className={clsx(
              "relative m-2 flex h-[256px] min-w-[256px] self-center border",
              "text-flathub-black",
              "bg-flathub-white",
            )}
          >
            <LogoImage iconUrl={app.icon} appName="" size="256" />
            <div className="z-10 absolute">
              <IconGrid />
            </div>
          </div>
          <div
            className={clsx(
              "relative m-2 flex h-[256px] min-w-[256px] self-center border",
              "text-flathub-white",
              "bg-flathub-dark-gunmetal",
            )}
          >
            <LogoImage iconUrl={app.icon} appName="" size="256" />
            <div className="z-10 absolute">
              <IconGrid />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const BrandingPreview = ({
  app,
  color,
}: {
  app: DesktopAppstream
  color: Branding
}) => {
  const textColor = color
    ? getContrastColor(color.value) === "black"
      ? "text-flathub-dark-gunmetal"
      : "text-flathub-lotion"
    : "text-flathub-dark-gunmetal dark:text-flathub-lotion"

  return (
    <div
      style={{ backgroundColor: color && color.value }}
      className={clsx(
        "relative m-2 flex h-[256px] min-w-[256px] self-center border",
        "text-flathub-white",
      )}
    >
      <div className="flex flex-col justify-center items-center h-auto w-full">
        <div className="relative flex flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md lg:h-[128px] lg:w-[128px]">
          <LogoImage iconUrl={app.icon} appName={app.name} />
        </div>
        <div className="flex pt-3">
          <span
            className={clsx(
              "truncate whitespace-nowrap text-2xl font-black",
              textColor,
            )}
          >
            {app.name}
          </span>
        </div>
        <div
          className={clsx(
            "line-clamp-2 text-sm text-center",
            textColor,
            "lg:line-clamp-3 pb-8",
          )}
        >
          {app.summary}
        </div>
        <div
          className={clsx(
            "line-clamp-2 text-sm text-center",
            textColor,
            "lg:line-clamp-3 pb-8",
          )}
        >
          {color.value}
        </div>
      </div>
    </div>
  )
}

const ShowBrandingButton = ({ app }: { app: DesktopAppstream }) => {
  const { t } = useTranslation()
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()

  if (!app.branding || app.branding?.length === 0) {
    return null
  }

  const primaryLight = chooseBrandingColor(app.branding, "light")
  const primaryDark = chooseBrandingColor(app.branding, "dark")

  return (
    <div>
      <Button
        variant="secondary"
        className="flex items-center gap-1"
        {...getToggleProps()}
      >
        <span>
          {t(
            isExpanded
              ? "quality-guideline.hide-branding-preview"
              : "quality-guideline.show-branding-preview",
          )}
        </span>
        <HiChevronUp
          className={clsx(
            "transition",
            !isExpanded ? "transform rotate-180" : "",
          )}
        />
      </Button>
      <section {...getCollapseProps()}>
        <div className="flex">
          <BrandingPreview app={app} color={primaryLight} />
          <BrandingPreview app={app} color={primaryDark} />
        </div>
      </section>
    </div>
  )
}

const QualityCategories = ({
  app,
  query,
  mode,
}: {
  app: DesktopAppstream
  query: UseQueryResult<AxiosResponse<QualityModerationResponse, any>, unknown>
  mode: "developer" | "moderator"
}) => {
  const { t } = useTranslation()

  const passAllMutation = useMutation({
    mutationFn: () => {
      return Promise.all(
        query.data.data.guidelines
          .filter((guideline) => !guideline.guideline.read_only)
          .map((guideline) =>
            setQualityModerationForAppQualityModerationAppIdPost(
              app.id,
              { guideline_id: guideline.guideline_id, passed: true },
              {
                withCredentials: true,
              },
            ),
          ) ?? [],
      )
    },

    onSuccess: (_data, variables) => {
      query.refetch()
    },
  })

  const dismissReviewMutation = useMutation({
    mutationFn: () =>
      deleteReviewRequestForAppQualityModerationAppIdRequestReviewDelete(
        app.id,
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      query.refetch()
    },
  })

  const categories = new Set<string>(
    query.data.data.guidelines.map((guideline) => guideline.guideline.category),
  )

  return (
    <div className="flex flex-col gap-4 dark:divide-flathub-granite-gray">
      {mode === "moderator" && (
        <div className="flex gap-3">
          {query.data.data.review_requested_at && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                dismissReviewMutation.mutateAsync()
              }}
            >
              Dismiss review request
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              passAllMutation.mutateAsync()
            }}
          >
            Pass all
          </Button>
        </div>
      )}
      {Array.from(categories).map((category) => {
        return (
          <div className="flex flex-col" key={category}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold pb-2 pt-4 first:pt-0">
                {t(`quality-guideline.${category}`)}
              </h3>
              {category === "screenshots" && (
                <ScreenShotTypeItem
                  mode={mode}
                  key={category}
                  appId={app.id}
                  query={query}
                  is_fullscreen_app={query.data.data.is_fullscreen_app}
                />
              )}
            </div>
            <div
              className={clsx(
                "flex flex-col text-sm gap-2 dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
              )}
            >
              {category === "app-icon" && <ShowIconButton app={app} />}
              {category === "branding" && <ShowBrandingButton app={app} />}
              {query.data.data.guidelines
                .filter((a) => a.guideline.category === category)
                .map((guideline) => (
                  <QualityItem
                    mode={mode}
                    key={guideline.guideline_id}
                    appId={app.id}
                    qualityGuideline={guideline.guideline}
                    qualityModeration={guideline}
                    query={query}
                  />
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const QualityItem = ({
  mode,
  appId,
  qualityModeration,
  qualityGuideline,
  query,
}: {
  mode: "developer" | "moderator"
  appId: string
  qualityModeration?: QualityModerationType
  qualityGuideline: Guideline | undefined
  query: UseQueryResult<AxiosResponse<QualityModerationResponse, any>, unknown>
}) => {
  const { t } = useTranslation()
  const [toggle, setToggle] = useState<boolean | null>(
    qualityModeration?.passed,
  )

  useEffect(() => {
    setToggle(qualityModeration?.passed)
  }, [qualityModeration])

  const mutation = useMutation({
    mutationFn: ({ passed }: { passed: boolean }) =>
      setQualityModerationForAppQualityModerationAppIdPost(
        appId,
        { guideline_id: qualityGuideline.id, passed },
        {
          withCredentials: true,
        },
      ),

    onSuccess: (_data, variables) => {
      setToggle(variables.passed)
      query.refetch()
    },
  })

  return (
    <div className={clsx("flex flex-col")}>
      <div className={clsx("flex items-center gap-1")}>
        <div>{t(`quality-guideline.${qualityGuideline.id}`)}</div>
        <a href={qualityGuideline.url} target="_blank" rel="noreferrer">
          <HiArrowTopRightOnSquare />
        </a>
        <div className="ms-auto">
          {qualityGuideline.read_only || mode === "developer" ? (
            <ReadOnlyItem toggle={toggle} />
          ) : (
            <MultiToggle
              size="sm"
              items={[
                {
                  id: "not-set",
                  content: <HiQuestionMarkCircle className="w-6 h-6" />,
                  selected: toggle === undefined,
                  onClick: () => {},
                  disabled: true,
                  color: "bg-flathub-gainsborow",
                },
                {
                  id: "not_passed",
                  content: <HiXMark className="w-6 h-6" />,
                  onClick: () => {
                    mutation.mutateAsync({ passed: false })
                  },
                  selected: toggle === false,
                  color: "bg-flathub-electric-red",
                },
                {
                  id: "passed",
                  content: <HiCheck className="w-6 h-6" />,
                  onClick: () => {
                    mutation.mutateAsync({ passed: true })
                  },
                  selected: toggle === true,
                },
              ]}
            />
          )}
        </div>
      </div>
      {isFuture(qualityGuideline.needed_to_pass_since) && (
        <div className="text-xs">
          {t("quality-guideline.needed-to-pass-x", {
            x: formatDistanceToNow(qualityGuideline.needed_to_pass_since, {
              addSuffix: true,
            }),
          })}
        </div>
      )}
    </div>
  )
}

const ScreenShotTypeItem = ({
  mode,
  appId,
  is_fullscreen_app,
  query,
}: {
  mode: "developer" | "moderator"
  appId: string
  is_fullscreen_app: boolean
  query: UseQueryResult<AxiosResponse<QualityModerationResponse, any>, unknown>
}) => {
  const { t } = useTranslation()
  const [toggle, setToggle] = useState<boolean>(is_fullscreen_app)

  useEffect(() => {
    setToggle(is_fullscreen_app)
  }, [is_fullscreen_app])

  const mutation = useMutation({
    mutationFn: ({ is_fullscreen_app }: { is_fullscreen_app: boolean }) =>
      setFullscreenAppQualityModerationAppIdFullscreenPost(
        appId,
        { is_fullscreen_app: is_fullscreen_app },
        {
          withCredentials: true,
        },
      ),

    onSuccess: (_data, variables) => {
      setToggle(variables.is_fullscreen_app)
      query.refetch()
    },
  })

  if (mode === "developer") {
    return null
  }

  return (
    <div className={clsx("flex items-center gap-1")}>
      <div className="ms-auto">
        <MultiToggle
          size="sm"
          items={[
            {
              id: "default",
              content: (
                <div className="w-6 h-6 flex items-center justify-center">
                  <HiMiniWindow className="w-5 h-5" />
                </div>
              ),
              onClick: () => {
                mutation.mutateAsync({ is_fullscreen_app: false })
              },
              selected: toggle === false,
            },
            {
              id: "fullscreen",
              content: (
                <div className="w-6 h-6 flex items-center justify-center">
                  <HiArrowsPointingOut className="w-5 h-5" />
                </div>
              ),
              onClick: () => {
                mutation.mutateAsync({ is_fullscreen_app: true })
              },
              selected: toggle === true,
            },
          ]}
        />
      </div>
    </div>
  )
}

const ReadOnlyItem = ({ toggle }) => {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const { x, y, refs, strategy, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [autoPlacement(), offset(6)],
  })
  const hover = useHover(context, { move: false })
  const role = useRole(context, { role: "tooltip" })

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role])

  const status =
    toggle === null ? "pending" : toggle === true ? "passed" : "not-passed"

  let content = <HiQuestionMarkCircle className="w-6 h-6" />
  if (status === "passed") {
    content = <HiCheckCircle className="w-6 h-6 text-flathub-celestial-blue" />
  } else if (status === "not-passed") {
    content = (
      <HiExclamationTriangle className="w-6 h-6 text-flathub-electric-red" />
    )
  }

  let hoverText = "quality-guideline.pending"
  if (status === "passed") {
    hoverText = "quality-guideline.passed"
  } else if (status === "not-passed") {
    hoverText = "quality-guideline.not-passed"
  }

  return (
    <>
      <button
        ref={refs.setReference}
        className="flex items-center justify-center"
        aria-label="read-only"
        {...getReferenceProps}
      >
        {content}
      </button>
      {isOpen && (
        <div
          ref={refs.setFloating}
          style={{
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
          }}
          className={clsx(
            "text-xs font-semibold",
            "z-40 mx-1 max-w-sm rounded-xl p-4",
            "border-1 border border-flathub-gray-x11 dark:border-flathub-sonic-silver",
            "bg-flathub-white dark:bg-flathub-granite-gray dark:text-flathub-gainsborow",
          )}
          {...getFloatingProps()}
        >
          {t(hoverText)}
        </div>
      )}
    </>
  )
}

export const QualityModerationSlideOver = ({
  mode,
  app,
  isQualityModalOpen,
  setIsQualityModalOpen,
}: {
  mode: "developer" | "moderator"
  app: DesktopAppstream
  isQualityModalOpen: boolean
  setIsQualityModalOpen: (value: boolean) => void
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["qualityModeration", { appId: app.id }],
    queryFn: ({ signal }) =>
      getQualityModerationForAppQualityModerationAppIdGet(app.id, {
        withCredentials: true,
        signal,
      }),
    enabled: !!app.id,
  })

  return (
    <SlideOver
      shown={isQualityModalOpen}
      onClose={() => setIsQualityModalOpen(false)}
      title={t("app-listing-quality")}
    >
      <div className="overflow-y-auto">
        {query.isPending ? (
          <div className="flex justify-center">
            <Spinner size={"l"} />
          </div>
        ) : query.isError ? (
          <div className="flex justify-center">
            <span className="text-flathub-red">{t("server-error")}</span>
          </div>
        ) : (
          <QualityCategories app={app} query={query} mode={mode} />
        )}
      </div>
    </SlideOver>
  )
}
