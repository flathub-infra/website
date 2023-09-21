import Modal from "../Modal"
import { useTranslation } from "react-i18next"
import {
  fetchQualityModerationForApp,
  postQualityModerationForApp,
} from "src/fetchers"
import { UseQueryResult, useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import { QualityModeration } from "src/types/QualityModeration"
import { useState } from "react"
import { toast } from "react-toastify"
import { AxiosResponse } from "axios"
import {
  HiArrowTopRightOnSquare,
  HiCheck,
  HiCheckCircle,
  HiExclamationTriangle,
  HiQuestionMarkCircle,
  HiXMark,
} from "react-icons/hi2"
import MultiToggle from "../MultiToggle"

const QualityCategories = ({
  query,
}: {
  query: UseQueryResult<AxiosResponse<QualityModeration[], any>, unknown>
}) => {
  const { t } = useTranslation()

  const uniqueCategories = Array.from(
    new Set(
      query.data?.data?.map(
        (qualityModeration) => qualityModeration.guideline.category,
      ),
    ),
  )

  return (
    <div className="flex flex-col gap-4 dark:divide-flathub-granite-gray">
      {uniqueCategories?.map((category) => {
        return (
          <div className="flex flex-col" key={category}>
            <div>
              <h3 className="font-semibold pb-2 pt-4 first:pt-0">
                {t(category)}
              </h3>
            </div>
            <div
              className={clsx(
                "flex flex-col text-sm gap-2 dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
              )}
            >
              {query?.data?.data
                ?.filter(
                  (qualityModeration) =>
                    qualityModeration.guideline.category === category,
                )
                .map((qualityModeration) => (
                  <QualityItem
                    key={qualityModeration.guideline.id}
                    qualityModeration={qualityModeration}
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
  qualityModeration,
  query,
}: {
  qualityModeration: QualityModeration
  query: UseQueryResult<AxiosResponse<QualityModeration[], any>, unknown>
}) => {
  const { t } = useTranslation()
  const [toggle, setToggle] = useState<boolean | null>(qualityModeration.passed)

  const mutation = useMutation({
    mutationFn: ({ passed }: { passed: boolean }) =>
      postQualityModerationForApp(
        qualityModeration.app_id,
        qualityModeration.guideline.translation_key,
        passed,
      ),

    onSuccess: (_data, variables) => {
      setToggle(variables.passed)
      query.refetch()
    },
  })

  return (
    <div className={clsx("flex items-center gap-1")}>
      <div>{t(qualityModeration.guideline.translation_key)}</div>
      <a
        href={qualityModeration.guideline.url}
        target="_blank"
        rel="noreferrer"
      >
        <HiArrowTopRightOnSquare />
      </a>
      <div className="ml-auto">
        {qualityModeration.guideline.read_only ? (
          qualityModeration.passed ? (
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
                selected: toggle === null,
                onClick: () => {},
                disabled: true,
              },
              {
                id: "not-passed",
                content: <HiXMark className="w-6 h-6" />,
                onClick: () => {
                  toast.promise(mutation.mutateAsync({ passed: false }), {
                    // Only for moderators, so no need to translate
                    pending: "Setting not passed",
                    success: "Not passed saved",
                    error: t("server-error"),
                  })
                },
                selected: toggle === false,
              },
              {
                id: "passed",
                content: <HiCheck className="w-6 h-6" />,
                onClick: () => {
                  toast.promise(mutation.mutateAsync({ passed: true }), {
                    // Only for moderators, so no need to translate
                    pending: "Setting passed",
                    success: "Passed saved",
                    error: t("server-error"),
                  })
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

export const QualityModerationModal = ({
  appId,
  isQualityModalOpen,
  setIsQualityModalOpen,
}: {
  appId: string
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
    <Modal
      shown={isQualityModalOpen}
      onClose={() => setIsQualityModalOpen(false)}
      title={t("app-listing-quality")}
    >
      <div className="overflow-y-auto max-h-[70vh]">
        {query.isLoading ? (
          <div className="flex justify-center">
            <Spinner size={"l"} />
          </div>
        ) : query.isError ? (
          <div className="flex justify-center">
            <span className="text-flathub-red">{t("server-error")}</span>
          </div>
        ) : (
          <QualityCategories query={query} />
        )}
      </div>
    </Modal>
  )
}
