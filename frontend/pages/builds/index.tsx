import { BuildDashboard } from "@/components/build/build-dashboard"
import { PipelineRepoWithAll } from "@/components/build/build-repo-filter"
import { PipelineStatusWithAll } from "@/components/build/build-status-filter"
import { translationMessages } from "i18n/request"
import { GetStaticProps } from "next"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

export default function Builds() {
  const router = useRouter()

  const [appId, setAppId] = useState<string>(undefined)
  const [statusFilter, setStatusFilter] = useState<PipelineStatusWithAll>("all")
  const [repoFilter, setRepoFilter] = useState<PipelineRepoWithAll>("all")

  useEffect(() => {
    if (router?.query?.appId) {
      setAppId(router.query.appId.toString())
    }
  }, [router?.query?.appId])

  return (
    <>
      <NextSeo
        title={"Builds"}
        description={"Monitor build and deployment processes"}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/builds`,
        }}
        noindex={router.locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="mt-8 mb-4 text-4xl font-extrabold">
          {!appId ? "Build Dashboard" : appId}{" "}
        </h1>
        <p className="mb-8">Monitor build and deployment processes</p>

        <BuildDashboard
          appId={appId}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          repoFilter={repoFilter}
          setRepoFilter={setRepoFilter}
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      messages: await translationMessages(locale),
    },
    revalidate: 900,
  }
}
