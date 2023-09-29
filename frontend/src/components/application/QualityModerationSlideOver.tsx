import { useTranslation } from "react-i18next"
import {
  fetchQualityModerationForApp,
  postQualityModerationForApp,
} from "src/fetchers"
import { UseQueryResult, useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import {
  QualityGuideline,
  QualityModeration,
  QualityModerationResponse,
} from "src/types/QualityModeration"
import { useState } from "react"
import { toast } from "react-toastify"
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

  return (
    <div className="flex flex-col gap-4 dark:divide-flathub-granite-gray">
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
                  <button {...getToggleProps()}>
                    <Button
                      variant="secondary"
                      className="flex items-center gap-1"
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
                          isExpanded ? "transform rotate-180" : "",
                        )}
                      />
                    </Button>
                  </button>
                  <section {...getCollapseProps()}>
                    <div className="flex">
                      <div className="relative m-2 flex h-[256px] min-w-[256px] self-center bg-flathub-white border text-flathub-black">
                        <LogoImage iconUrl={appIcon} appName="" />
                        <div className="z-10">
                          <IconGrid />
                        </div>
                      </div>
                      <div className="relative m-2 flex h-[256px] min-w-[256px] self-center bg-flathub-dark-gunmetal border text-flathub-white">
                        <LogoImage iconUrl={appIcon} appName="" />
                        <div className="z-10">
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
  qualityModeration?: QualityModeration
  qualityGuideline: QualityGuideline | undefined
  query: UseQueryResult<AxiosResponse<QualityModerationResponse, any>, unknown>
}) => {
  const { t } = useTranslation()
  const [toggle, setToggle] = useState<boolean | null>(
    qualityModeration?.passed,
  )

  const mutation = useMutation({
    mutationFn: ({ passed }: { passed: boolean }) =>
      postQualityModerationForApp(appId, qualityGuideline.id, passed),

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
            items={[
              {
                id: "not-set",
                content: <HiQuestionMarkCircle className="w-6 h-6" />,
                selected: toggle === undefined,
                onClick: () => {},
                disabled: true,
              },
              {
                id: "not-passed",
                content: <HiXMark className="w-6 h-6" />,
                onClick: () => {
                  toast.promise(
                    mutation.mutateAsync({ passed: false }),
                    {
                      // Only for moderators, so no need to translate
                      pending: "Setting not passed",
                      success: "Not passed saved",
                      error: t("server-error"),
                    },
                    { toastId: "quality-moderation" },
                  )
                },
                selected: toggle === false,
              },
              {
                id: "passed",
                content: <HiCheck className="w-6 h-6" />,
                onClick: () => {
                  toast.promise(
                    mutation.mutateAsync({ passed: true }),
                    {
                      // Only for moderators, so no need to translate
                      pending: "Setting passed",
                      success: "Passed saved",
                      error: t("server-error"),
                    },
                    {
                      toastId: "quality-moderation",
                    },
                  )
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
    queryFn: () => fetchQualityModerationForApp(appId),
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
