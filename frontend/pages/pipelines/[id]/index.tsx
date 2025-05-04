import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useGetPipelineApiPipelinesPipelineIdGet } from "src/codegen-pipeline"
import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import Spinner from "src/components/Spinner"
import {
  getRepoBadgeVariant,
  PipelineCardContent,
} from "@/components/pipeline/pipeline-card"
import { Badge } from "@/components/ui/badge"
import { NextSeo } from "next-seo"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export default function ApplicationPage({
  pipelineId,
  locale,
}: {
  pipelineId: string
  locale: string
}) {
  const query = useGetPipelineApiPipelinesPipelineIdGet(pipelineId)

  if (query.isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Spinner size="m" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Error: {query.error.message}</p>
      </div>
    )
  }

  return (
    <>
      <NextSeo
        title={`${query.data.data.app_id} build`}
        description={`A build pipeline for ${query.data.data.app_id}`}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/pipelines/${query.data.data.id}`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Link href="/pipelines">
          <Button variant="ghost" className="mb-6">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <h1 className="text-3xl font-bold mb-6">
                {query.data.data.app_id}
              </h1>
              {query.data.data.repo && (
                <Badge variant={getRepoBadgeVariant(query.data.data.repo)}>
                  {query.data.data.repo}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pb-2">
            <PipelineCardContent pipelineSummary={query.data.data} />
          </CardContent>

          <CardFooter className="pt-2">
            {query.data.data.log_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-6"
                asChild
              >
                <a
                  href={query.data.data.log_url}
                  className="size-4 mr-2"
                  target="_blank"
                >
                  View Log
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { id: pipelineId },
}: {
  locale: string
  defaultLocale: string
  params: { id: string }
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      pipelineId,
      locale,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
