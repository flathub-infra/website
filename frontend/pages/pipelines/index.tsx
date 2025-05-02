import { PipelineDashboard } from "@/components/pipeline/pipeline-dashboard"
import { PipelineStatus } from "@/components/pipeline/pipeline-filter"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

export default function Home() {
  const router = useRouter()

  const [appId, setAppId] = useState<string>(undefined)
  const [statusFilter, setStatusFilter] = useState<PipelineStatus>("all")

  useEffect(() => {
    if (router?.query?.appId) {
      setAppId(router.query.appId.toString())
    }
  }, [router?.query?.appId])

  return (
    <>
      <NextSeo
        title={"Pipelines"}
        description={"Monitor build and deployment processes"}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/pipelines`,
        }}
        noindex={router.locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="mt-8 mb-4 text-4xl font-extrabold">
          Pipeline Dashboard
        </h1>
        <p className="mb-8">Monitor build and deployment processes</p>

        <PipelineDashboard
          appId={appId}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
    revalidate: 900,
  }
}
