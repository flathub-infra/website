import { UseQueryResult, useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { AxiosResponse } from "axios"
import {
  HiArrowTopRightOnSquare,
  HiCheck,
  HiCheckCircle,
  HiChevronUp,
  HiExclamationTriangle,
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
import { qualityModerationApi } from "src/api"
import {
  Guideline,
  QualityModerationResponse,
  QualityModerationType,
} from "src/codegen"

const QualityCategories = ({
  appId,
  appIcon,
  query,
}: {
  appId: string
  appIcon: string
  query: UseQueryResult<AxiosResponse<QualityModerationResponse, any>, unknown>
}) => {
  const { t } = useTranslation()
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()

  const passAllMutation = useMutation({
    mutationFn: () => {
      return Promise.all(
        query.data.data.categories?.flatMap((category) =>
          category.guidelines
            .filter((guideline) => !guideline.read_only)
            .map((guideline) =>
              qualityModerationApi.setQualityModerationForAppQualityModerationAppIdPost(
                appId,
                { guideline_id: guideline.id, passed: true },
                {
                  withCredentials: true,
                },
              ),
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
      qualityModerationApi.deleteReviewRequestForAppQualityModerationAppIdRequestReviewDelete(
        appId,
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      query.refetch()
    },
  })

  return (
    <div className="flex flex-col gap-4 dark:divide-flathub-granite-gray">
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
      {query.data.data.categories?.map((category) => {
        return (
          <div className="flex flex-col" key={category.id}>
            <div>
              <h3 className="font-semibold pb-2 pt-4 first:pt-0">
                {t(`quality-guideline.${category.id}`)}
              </h3>
            </div>
            <div
              className={clsx(
                "flex flex-col text-sm gap-2 dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
              )}
            >
              {category.id === "app-icon" && (
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
                      <div className="relative m-2 flex h-[256px] min-w-[256px] self-center bg-flathub-white border text-flathub-black">
                        <LogoImage iconUrl={appIcon} appName="" size="256" />
                        <div className="z-10 absolute">
                          <IconGrid />
                        </div>
                      </div>
                      <div className="relative m-2 flex h-[256px] min-w-[256px] self-center bg-flathub-dark-gunmetal border text-flathub-white">
                        <LogoImage iconUrl={appIcon} appName="" size="256" />
                        <div className="z-10 absolute">
                          <IconGrid />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {category.guidelines.map((guideline) => (
                <QualityItem
                  key={guideline.id}
                  appId={appId}
                  qualityGuideline={guideline}
                  qualityModeration={query.data.data.marks[guideline.id]}
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
  appId,
  qualityModeration,
  qualityGuideline,
  query,
}: {
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
      qualityModerationApi.setQualityModerationForAppQualityModerationAppIdPost(
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
    <div className={clsx("flex items-center gap-1")}>
      <div>{t(`quality-guideline.${qualityGuideline.id}`)}</div>
      <a href={qualityGuideline.url} target="_blank" rel="noreferrer">
        <HiArrowTopRightOnSquare />
      </a>
      <div className="ms-auto">
        {qualityGuideline.read_only ? (
          qualityModeration?.passed ? (
            <HiCheckCircle className="w-6 h-6 text-flathub-celestial-blue" />
          ) : (
            <HiExclamationTriangle className="w-6 h-6 text-flathub-electric-red" />
          )
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
  )
}

export const QualityModerationSlideOver = ({
  appId,
  appIcon,
  isQualityModalOpen,
  setIsQualityModalOpen,
}: {
  appId: string
  appIcon: string
  isQualityModalOpen: boolean
  setIsQualityModalOpen: (value: boolean) => void
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["qualityModeration", appId],
    queryFn: () =>
      qualityModerationApi.getQualityModerationForAppQualityModerationAppIdGet(
        appId,
        {
          withCredentials: true,
        },
      ),
    enabled: !!appId,
  })

  return (
    <SlideOver
      shown={isQualityModalOpen}
      onClose={() => setIsQualityModalOpen(false)}
      title={t("app-listing-quality")}
    >
      <div className="overflow-y-auto">
        {query.isLoading ? (
          <div className="flex justify-center">
            <Spinner size={"l"} />
          </div>
        ) : query.isError ? (
          <div className="flex justify-center">
            <span className="text-flathub-red">{t("server-error")}</span>
          </div>
        ) : (
          <QualityCategories appId={appId} query={query} appIcon={appIcon} />
        )}
      </div>
    </SlideOver>
  )
}
